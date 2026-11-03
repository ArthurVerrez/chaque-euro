import unittest
from pathlib import Path

import duckdb

SQL = Path(__file__).parents[1] / "sql"


class EuropeTest(unittest.TestCase):
    def test_layout_changes_and_adjustments_preserve_accounting_perimeter(self) -> None:
        with duckdb.connect() as con:
            con.execute(
                "create table eu_cells (year integer, line integer, "
                "A varchar, B varchar, C varchar, D varchar, R varchar, S varchar)"
            )
            rows = [
                (2000, 3, None, None, None, None, None, "FR"),
                (2000, 59, None, None, None, "TOTAL EXPENDITURE", None, "10"),
                (2000, 74, None, None, None, "TOTAL own resources", None, "12"),
                (2001, 14, None, None, None, None, None, "FR"),
                (2001, 70, None, None, "TOTAL EXPENDITURE", None, None, "10"),
                (2001, 85, None, None, "TOTAL own resources", None, None, "12"),
                (2025, 3, None, None, None, None, "FR", None),
                (2025, 5, "1.", "Innovation", None, None, "10", None),
                (2025, 142, "TOTAL EXPENDITURE", " ", None, "999", "10", None),
                (2025, 148, "1.", "NGEU innovation", None, None, "3", None),
                (2025, 159, "TOTAL NGEU", None, None, None, "3", None),
                (2025, 164, None, "REVENUE", None, None, "FR", None),
                (2025, 166, None, "Customs duties", None, None, "2", None),
                (2025, 171, None, "TOTAL Own resources", None, None, "12", None),
                (2025, 179, None, "TOTAL Balances and adjustments", None, None, "1", None),
            ]
            con.executemany("insert into eu_cells values (?, ?, ?, ?, ?, ?, ?, ?)", rows)
            con.execute(
                "create table france_population as select year, 1000000 as population "
                "from (values (2000), (2001), (2025)) t(year)"
            )
            con.execute((SQL / "32_europe.sql").read_text())
            self.assertEqual(
                con.execute(
                    "select year, balance, per_capita from eu_flows order by year"
                ).fetchall(),
                [(2000, -2e6, -2.0), (2001, -2e6, -2.0), (2025, -3e6, -3.0)],
            )
            self.assertEqual(
                con.execute("select year, amount from eu_headings").fetchall(), [(2025, 10e6)]
            )
