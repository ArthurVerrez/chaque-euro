import ssl
import subprocess
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

from chaque_euro.fetch import _open, fetch_file, sha256_of
from chaque_euro.registry import load_registry


class FetchTlsTest(unittest.TestCase):
    def test_uses_system_trust_with_certificate_and_hostname_verification(self) -> None:
        source = next(source for source in load_registry() if source.id == "eurostat-finances")
        with patch("chaque_euro.fetch.urllib.request.urlopen") as urlopen:
            _open(next(iter(source.files.values())))
        context = urlopen.call_args.kwargs["context"]
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(context.check_hostname)

    def test_tls_and_reset_fallback_verifies_https_and_saves_hash_and_final_url(self) -> None:
        source = next(source for source in load_registry() if source.id == "dss-branches-2026")
        assert source.file_url

        def download(args: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
            Path(args[args.index("--output") + 1]).write_bytes(b"official workbook")
            self.assertNotIn("--insecure", args)
            self.assertIn("--fail", args)
            self.assertEqual(args[args.index("--proto") + 1], "=https")
            self.assertEqual(args[args.index("--proto-redir") + 1], "=https")
            return subprocess.CompletedProcess(args, 0, stdout=source.file_url)

        for error in (urllib.error.URLError(ssl.SSLError()), ConnectionResetError(104, "reset")):
            with (
                self.subTest(error=error),
                tempfile.TemporaryDirectory() as directory,
                patch("chaque_euro.fetch._open", side_effect=error),
                patch("chaque_euro.fetch.subprocess.run", side_effect=download),
            ):
                record = fetch_file(source, Path(directory), True)
                self.assertEqual(record.urls, [source.file_url])
                self.assertEqual(record.sha256, sha256_of(Path(record.path)))
                self.assertTrue(Path(record.path + ".fetch.json").is_file())


class RefreshTest(unittest.TestCase):
    def setUp(self) -> None:
        import threading
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.raw = Path(self.directory.name)
        self.requests: list[dict[str, str]] = []
        requests = self.requests
        self.responses: dict[str, bytes] = {}
        responses = self.responses
        self.fail_paths: set[str] = set()
        fail_paths = self.fail_paths

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                requests.append(dict(self.headers))
                if self.path == "/error" or self.path in fail_paths:
                    self.send_error(503)
                elif self.headers.get("If-None-Match") == '"v1"':
                    self.send_response(304)
                    self.end_headers()
                else:
                    self.send_response(200)
                    self.send_header("ETag", '"v1"')
                    self.send_header("Last-Modified", "Mon, 02 Nov 2026 00:00:00 GMT")
                    self.end_headers()
                    self.wfile.write(responses.get(self.path, b"official data"))

            def log_message(self, *args: object) -> None:
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever)
        self.thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.thread.join)
        self.addCleanup(self.server.shutdown)
        from dataclasses import replace

        source = next(source for source in load_registry() if source.id == "decp")
        self.source = replace(
            source, file_url=f"http://127.0.0.1:{self.server.server_port}/data", filename="data.csv"
        )

    def test_conditional_304_preserves_content_hash_and_download_date(self) -> None:
        first = fetch_file(self.source, self.raw, False)
        with patch("chaque_euro.fetch._now", return_value="2026-12-01T04:00:00+00:00"):
            second = fetch_file(self.source, self.raw, True)
        self.assertEqual(Path(first.path).read_bytes(), b"official data")
        self.assertEqual(first.sha256, second.sha256)
        self.assertEqual(first.retrieved_at, second.retrieved_at)
        self.assertEqual(second.checked_at, "2026-12-01T04:00:00+00:00")
        self.assertEqual(self.requests[-1]["If-None-Match"], '"v1"')
        self.assertEqual(self.requests[-1]["If-Modified-Since"], first.last_modified)
        self.assertIsNone(second.error)

    def test_refresh_failure_keeps_previous_file_and_marks_error(self) -> None:
        from dataclasses import replace

        first = fetch_file(self.source, self.raw, False)
        failing = replace(self.source, file_url=self.source.file_url.replace("/data", "/error"))
        with self.assertLogs(level="WARNING"):
            second = fetch_file(failing, self.raw, True)
        self.assertEqual(first.sha256, second.sha256)
        self.assertEqual(first.checked_at, second.checked_at)
        self.assertEqual(Path(first.path).read_bytes(), b"official data")
        self.assertIn("503", second.error or "")
        self.assertTrue(second.failed_at)
        with self.assertRaises(urllib.error.HTTPError):
            fetch_file(replace(failing, filename="missing.csv"), self.raw, True)
        recovered = fetch_file(self.source, self.raw, False)
        self.assertIsNone(recovered.error)
        self.assertIsNone(recovered.failed_at)

    def test_copied_sidecar_uses_current_raw_directory(self) -> None:
        import shutil

        first = fetch_file(self.source, self.raw, False)
        copied = self.raw / "copied"
        shutil.copytree(self.raw / self.source.id, copied / self.source.id)
        with patch("chaque_euro.fetch._open", side_effect=AssertionError("unexpected fetch")):
            second = fetch_file(self.source, copied, False)
        self.assertEqual(Path(second.path), copied / self.source.id / "data.csv")
        self.assertEqual(first.sha256, second.sha256)

    def test_daily_due_on_next_paris_day_even_before_24_hours(self) -> None:
        from dataclasses import replace
        from datetime import UTC, datetime

        from chaque_euro.fetch import _due

        record = fetch_file(self.source, self.raw, False)
        record = replace(record, checked_at="2026-11-03T03:05:00+00:00")
        with patch("chaque_euro.fetch.datetime") as clock:
            clock.fromisoformat.side_effect = datetime.fromisoformat
            clock.now.return_value = datetime(2026, 11, 4, 3, 0, tzinfo=UTC)
            self.assertTrue(_due(self.source, record, False))
            self.assertFalse(
                _due(self.source, replace(record, checked_at=clock.now().isoformat()), False)
            )

    def test_max_age_mapping(self) -> None:
        from dataclasses import replace

        for frequency, days in (
            ("Quotidienne", 1),
            ("Quotidienne, deux fois par jour", 1),
            ("Trimestrielle annoncée, flux actualisé quotidiennement", 1),
            ("Hebdomadaire, par scrutin", 7),
            ("Mensuelle", 30),
            ("Mensuelle, contrôle de référence", 30),
            ("Mensuelle, contrôle de publication", 30),
            ("Trimestrielle", 30),
            ("Annuelle, publication différée", 30),
            ("Ponctuelle", 30),
            ("Occasionnelle", 30),
            ("À chaque scrutin", 30),
            ("À chaque découpage électoral", 30),
            ("Selon réglementation", 30),
        ):
            self.assertEqual(replace(self.source, frequency=frequency).max_age_days, days)

    def test_files_and_rolling_index_are_checked_and_failures_are_visible(self) -> None:
        from dataclasses import replace
        from datetime import UTC, datetime

        from chaque_euro.fetch import fetch

        base = self.source.file_url.removesuffix("/data")
        day = datetime.now(UTC).strftime("%Y%m%d")
        filename = f"JORF_{day}.tar.gz"
        self.responses["/index/"] = f'<a href="{filename}">journal</a>'.encode()
        source = replace(
            self.source,
            kind="files",
            file_url=base + "/index/",
            delivery_pattern="JORF",
            rolling_days=30,
        )
        first = fetch(source, self.raw, False)
        second = fetch(source, self.raw, True)
        assert first and second
        self.assertEqual(first.sha256, second.sha256)
        self.assertEqual(Path(second.path), self.raw / source.id)
        self.assertIsNone(second.error)
        self.fail_paths.add("/index/" + filename)
        with self.assertLogs(level="WARNING"):
            failed = fetch(source, self.raw, True)
        assert failed
        self.assertEqual(first.sha256, failed.sha256)
        self.assertTrue(failed.error)
        self.assertEqual((Path(first.path) / filename).read_bytes(), b"official data")

    def test_rolling_deliveries_outlive_index_purge_until_window_ends(self) -> None:
        from dataclasses import replace
        from datetime import UTC, datetime, timedelta

        from chaque_euro.fetch import fetch

        base = self.source.file_url.removesuffix("/data")
        now = datetime.now(UTC)
        old, recent, latest = (
            f"JORF_{(now - timedelta(days=age)).strftime('%Y%m%d')}.tar.gz" for age in (40, 5, 0)
        )
        self.responses["/index/"] = "".join(
            f'<a href="{name}">journal</a>' for name in (old, recent, latest)
        ).encode()
        source = replace(
            self.source,
            kind="files",
            file_url=base + "/index/",
            delivery_pattern="JORF",
            rolling_days=60,
        )
        fetch(source, self.raw, False)
        directory = self.raw / source.id
        (directory / "index.html.fetch.json").unlink()
        self.responses["/index/"] = f'<a href="{latest}">journal</a>'.encode()
        record = fetch(replace(source, rolling_days=30), self.raw, True)
        assert record
        self.assertFalse((directory / old).exists())
        self.assertTrue((directory / recent).exists())
        self.assertIn(base + "/index/" + recent, record.urls)
        self.assertIsNone(record.error)

    def test_new_stock_supersedes_older_stock_and_deliveries(self) -> None:
        from dataclasses import replace

        from chaque_euro.fetch import fetch

        base = self.source.file_url.removesuffix("/data")
        before = ["Freemium_dole_20250101-140000.tar.gz", "DOLE_20250102-210000.tar.gz"]
        after = ["Freemium_dole_20260101-140000.tar.gz", "DOLE_20260102-210000.tar.gz"]
        source = replace(
            self.source, kind="files", file_url=base + "/index/", delivery_pattern="DOLE"
        )
        directory = self.raw / source.id
        for listed, kept in ((before, before), (before[:1] + after, after)):
            directory.joinpath("index.html.fetch.json").unlink(missing_ok=True)
            self.responses["/index/"] = "".join(
                f'<a href="{name}">dossiers</a>' for name in listed
            ).encode()
            record = fetch(source, self.raw, True)
            assert record
            self.assertIsNone(record.error)
            self.assertEqual(sorted(path.name for path in directory.glob("*.tar.gz")), sorted(kept))

    def test_ofgl_queries_use_validators_and_keep_output_on_failure(self) -> None:
        import json
        import urllib.parse
        from dataclasses import replace

        from chaque_euro.fetch import OFGL_GROUP_FIELDS, fetch_ofgl_records

        source = replace(
            self.source,
            kind="ofgl_records",
            years=[2026],
            aggregates=["total"],
            filename="records.jsonl",
        )
        department = {"where": "exer=date'2026'", "group_by": "dep_code", "limit": "500"}
        page = {
            "where": 'exer=date\'2026\' and dep_code="69" and agregat in ("total")',
            "group_by": OFGL_GROUP_FIELDS,
            "select": "sum(montant) as montant",
            "limit": "20000",
        }
        for params, results in ((department, [{"dep_code": "69"}]), (page, [{"montant": 123}])):
            url = "/data?" + urllib.parse.urlencode(params)
            self.responses[url] = json.dumps({"results": results, "total_count": 1}).encode()
        with patch("chaque_euro.fetch.time.sleep"):
            first = fetch_ofgl_records(source, self.raw, False)
            second = fetch_ofgl_records(source, self.raw, True)
        self.assertEqual(first.sha256, second.sha256)
        self.assertTrue(any("If-None-Match" in request for request in self.requests))
        self.fail_paths.add("/data?" + urllib.parse.urlencode(department))
        with self.assertLogs(level="WARNING"):
            failed = fetch_ofgl_records(source, self.raw, True)
        self.assertEqual(failed.sha256, first.sha256)
        self.assertEqual(Path(failed.path).read_text(), '{"year": 2026, "montant": 123}\n')
        self.assertTrue(failed.error)
