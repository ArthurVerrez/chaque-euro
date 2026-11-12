import json
import sqlite3
import tempfile
import unittest
from contextlib import redirect_stdout
from dataclasses import replace
from io import StringIO
from pathlib import Path

from chaque_euro.build import pipeline_hash
from chaque_euro.cli import unchanged
from chaque_euro.fetch import FetchRecord
from chaque_euro.publish import gate, late_sources, prepare_database, update_freshness


class PublicationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.old = self.database("old.sqlite", 10)

    def database(self, name: str, count: int) -> Path:
        path = self.root / name
        with sqlite3.connect(path) as db:
            db.execute("create table records (id integer)")
            db.executemany("insert into records values (?)", [(i,) for i in range(count)])
        return path

    def test_gate_allows_exactly_twenty_percent_drop_and_additions(self) -> None:
        candidate = self.database("new.sqlite", 8)
        with sqlite3.connect(candidate) as db:
            db.execute("create table extra (id integer)")
        with redirect_stdout(StringIO()):
            self.assertTrue(gate(candidate, self.old))
            self.assertTrue(gate(candidate, None))

    def test_gate_rejects_drops_missing_and_empty_tables(self) -> None:
        for name, count in (("dropped", 7), ("empty", 0), ("missing", 10)):
            candidate = self.database(name + ".sqlite", count)
            if name == "missing":
                with sqlite3.connect(candidate) as db:
                    db.execute("alter table records rename to replacement")
            report = StringIO()
            with redirect_stdout(report):
                self.assertFalse(gate(candidate, self.old))
            self.assertIn("FAIL: records", report.getvalue())

    def test_gate_lets_source_urls_shrink_but_not_vanish(self) -> None:
        def with_urls(name: str, count: int) -> Path:
            path = self.database(name, 10)
            with sqlite3.connect(path) as db:
                db.execute("create table source_urls (url text)")
                db.executemany(
                    "insert into source_urls values (?)", [(str(i),) for i in range(count)]
                )
            return path

        published = with_urls("urls-old.sqlite", 100)
        with redirect_stdout(StringIO()):
            self.assertTrue(gate(with_urls("urls-merged.sqlite", 2), published))
            self.assertFalse(gate(with_urls("urls-empty.sqlite", 0), published))

    def test_prepare_preserves_miniflare_metadata_without_changing_inputs(self) -> None:
        with sqlite3.connect(self.old) as db:
            db.execute("create table _cf_METADATA (key integer primary key, value blob)")
            db.execute("insert into _cf_METADATA values (2, 17095)")
        candidate = self.database("new.sqlite", 12)
        output = self.root / "prepared.sqlite"
        prepare_database(candidate, self.old, output)
        with sqlite3.connect(output) as db:
            self.assertEqual(db.execute("select count(*) from records").fetchone()[0], 12)
            self.assertEqual(db.execute("select * from _cf_METADATA").fetchall(), [(2, 17095)])
        with sqlite3.connect(self.old) as db:
            self.assertEqual(db.execute("select count(*) from records").fetchone()[0], 10)
        with self.assertRaises(FileExistsError):
            prepare_database(candidate, self.old, output)

    def test_unchanged_requires_same_source_hashes_and_pipeline_hash(self) -> None:
        record = FetchRecord("a", "unused", [], "2026-11-01T00:00:00Z", None, 1, "hash")
        manifest = {"pipeline_hash": pipeline_hash(), "sources": [{"id": "a", "sha256": "hash"}]}
        path = self.root / "manifest.json"
        path.write_text(json.dumps(manifest))
        self.assertTrue(unchanged({"a": record}, self.root))
        self.assertFalse(unchanged({"a": replace(record, sha256="new")}, self.root))
        self.assertFalse(unchanged({}, self.root))
        manifest["pipeline_hash"] = "old code"
        path.write_text(json.dumps(manifest))
        self.assertFalse(unchanged({"a": record}, self.root))

    def test_metadata_only_refresh_preserves_data_and_records_failures(self) -> None:
        with sqlite3.connect(self.old) as db:
            db.execute(
                "create table sources (id text, checked_at text, refresh_error text, sha256 text)"
            )
            db.execute("insert into sources values ('a', 'old', null, 'hash')")
        record = FetchRecord(
            "a", "unused", [], "old", None, 1, "hash", checked_at="yesterday", error="HTTP 503"
        )
        update_freshness(self.old, {"a": record})
        with sqlite3.connect(self.old) as db:
            self.assertEqual(
                db.execute("select * from sources").fetchall(),
                [("a", "yesterday", "HTTP 503", "hash")],
            )
            self.assertEqual(db.execute("select count(*) from records").fetchone()[0], 10)

    def test_late_sources_lists_failures_beyond_threshold(self) -> None:
        with sqlite3.connect(self.old) as db:
            db.execute(
                "create table sources (id text, checked_at text, refresh_error text, "
                "freshness_retrieval_days integer)"
            )
            db.executemany(
                "insert into sources values (?, ?, ?, ?)",
                [
                    ("late", "2020-01-01T04:00:00+00:00", "HTTP 503", 3),
                    ("recent", "2999-01-01T04:00:00+00:00", "HTTP 503", 3),
                    ("ok", "2020-01-01T04:00:00+00:00", None, 3),
                    ("occasional", "2020-01-01T04:00:00+00:00", "HTTP 503", 0),
                    ("never", None, "HTTP 503", 3),
                ],
            )
        self.assertEqual(late_sources(self.old), ["late", "never"])
