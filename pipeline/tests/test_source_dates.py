import json
import tempfile
import unittest
import zipfile
from dataclasses import replace
from pathlib import Path

import duckdb

from chaque_euro.build import _source_rows
from chaque_euro.fetch import FetchRecord
from chaque_euro.registry import load_registry
from chaque_euro.source_dates import source_data_date


class SourceDatesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name)
        self.sources = {source.id: source for source in load_registry()}

    def tearDown(self) -> None:
        self.directory.cleanup()

    def record(self, filename: str) -> FetchRecord:
        return FetchRecord("fixture", str(self.path / filename), [], "2026-11-04", None, 0, "")

    def test_reference_and_constant_without_download_are_not_missing_fetches(self) -> None:
        for source_id in ("insee-menages", "insee-apu-definition", "hatvp-person"):
            with self.subTest(source_id=source_id):
                source = self.sources[source_id]
                row = _source_rows([source], {}, {})[0]
                self.assertEqual(row[-1], 0)
                self.assertIsNone(row[13])
                self.assertEqual(row[19], source.data_date)
        for source_id in ("an-members", "dgcl-dotations-2026"):
            source = self.sources[source_id]
            self.assertEqual(_source_rows([source], {}, {})[0][-1], 1)

    def test_roster_uses_archive_extraction_not_mandate_or_retrieval_date(self) -> None:
        record = self.record("members.zip")
        with zipfile.ZipFile(record.path, "w") as archive:
            entry = zipfile.ZipInfo("json/acteur/PA1.json", (2026, 11, 3, 3, 50, 0))
            archive.writestr(entry, '{"dateDebut": "2024-07-08"}')
        self.assertEqual(source_data_date(self.sources["an-members"], record), "2026-11-03")

    def test_senate_uses_oldest_publisher_export_in_collection(self) -> None:
        source = self.sources["senat-members"]
        record = self.record(".")
        for index, filename in enumerate(source.files):
            (self.path / f"{filename}.fetch.json").write_text(
                json.dumps({"published_at": f"Tue, 0{index + 1} Nov 2026 03:17:18 GMT"})
            )
        self.assertEqual(source_data_date(source, record), "2026-11-01")
        (self.path / "general.csv.fetch.json").unlink()
        self.assertIsNone(source_data_date(source, record))

    def test_page_update_and_unknown_date_are_preserved(self) -> None:
        source = self.sources["cnccfp-status"]
        record = self.record("parties.html")
        Path(record.path).write_text("Dernière mise à jour le 05/06/2026")
        self.assertEqual(source_data_date(source, record), "2026-06-05")
        Path(record.path).write_text("Aucune date publiée")
        self.assertIsNone(source_data_date(source, record))
        source = self.sources["competition-sanctions"]
        self.assertIsNone(source_data_date(source, record))
        self.assertEqual(
            source_data_date(source, replace(record, published_at="Sun, 01 Nov 2026 11:02:44 GMT")),
            "2026-11-01",
        )

    def test_local_dates_follow_exercise_and_revenue_year(self) -> None:
        with duckdb.connect() as con:
            con.execute("create table coverage_dates (source_id varchar, data_date date)")
            con.execute(
                "create table local_account_rows as select * from "
                "(values ('departement', 2024), ('departement', 2025), "
                "('region', 2025), ('epci', 2025)) t(level, year)"
            )
            con.execute("create table commune_taxes as select 2025 as year")
            con.execute("create table commune_income as select 2024 as revenue_year")
            sql = Path(__file__).resolve().parents[1] / "sql/95_local_source_dates.sql"
            con.execute(sql.read_text())
            dates = dict(
                con.execute("select source_id, data_date::varchar from coverage_dates").fetchall()
            )
            self.assertEqual(dates["ofgl-departements"], "2025-12-31")
            self.assertEqual(dates["ofgl-regions"], "2025-12-31")
            self.assertEqual(dates["ofgl-epci"], "2025-12-31")
            self.assertEqual(dates["rei-2025"], "2025-12-31")
            self.assertEqual(dates["ircom-2025"], "2024-12-31")
