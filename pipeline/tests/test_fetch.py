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

    def test_tls_fallback_verifies_https_and_saves_hash_and_final_url(self) -> None:
        source = next(source for source in load_registry() if source.id == "dss-branches-2026")
        assert source.file_url
        with tempfile.TemporaryDirectory() as directory:

            def download(args: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
                Path(args[args.index("--output") + 1]).write_bytes(b"official workbook")
                self.assertNotIn("--insecure", args)
                self.assertIn("--fail", args)
                self.assertEqual(args[args.index("--proto") + 1], "=https")
                self.assertEqual(args[args.index("--proto-redir") + 1], "=https")
                return subprocess.CompletedProcess(args, 0, stdout=source.file_url)

            with (
                patch("chaque_euro.fetch._open", side_effect=urllib.error.URLError(ssl.SSLError())),
                patch("chaque_euro.fetch.subprocess.run", side_effect=download),
            ):
                record = fetch_file(source, Path(directory), True)
            self.assertEqual(record.urls, [source.file_url])
            self.assertEqual(record.sha256, sha256_of(Path(record.path)))
            self.assertTrue(Path(record.path + ".fetch.json").is_file())
