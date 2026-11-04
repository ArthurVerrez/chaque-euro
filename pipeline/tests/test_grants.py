import tempfile
import unittest
from pathlib import Path

import duckdb


class GrantsTest(unittest.TestCase):
    def test_workbook_keeps_corrections_and_normalises_identifiers_and_purpose(self) -> None:
        with tempfile.TemporaryDirectory() as directory, duckdb.connect() as con:
            con.execute("install excel; load excel")
            path = str(Path(directory) / "grants.xlsx")
            con.execute(
                "create table payments (Programme varchar, SIREN varchar, Montant varchar, "
                '"Objet 2025" varchar, "Dénomination" varchar)'
            )
            con.executemany(
                "insert into payments values (?, ?, ?, ?, ?)",
                [
                    (" 163 ", " 775672272 ", "1250.50", "Action\u00a0\n sociale", "Ignored"),
                    ("163", "775672272", "-25.50", " ", "Ignored"),
                    ("101", "NR CHORUS", "10", None, "Ignored"),
                    ("101", "123456789", "invalid", "Invalid amount", "Ignored"),
                ],
            )
            con.execute("copy payments to ? (format xlsx, header true)", [path])
            con.execute("set variable jaune_path = ?", [path])
            con.execute((Path(__file__).parents[1] / "sql/20_grants.sql").read_text())
            self.assertEqual(
                con.execute("select * from grant_rows order by amount desc").fetchall(),
                [
                    ("775672272", "163", 1250.5, "Action sociale", 2025),
                    (None, "101", 10.0, None, 2025),
                    ("775672272", "163", -25.5, None, 2025),
                ],
            )
