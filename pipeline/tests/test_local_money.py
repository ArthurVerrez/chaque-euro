import unittest
from pathlib import Path

import duckdb

SQL = Path(__file__).parents[1] / "sql"


class LocalMoneyTest(unittest.TestCase):
    def test_income_units_geography_and_fiscal_secrecy(self) -> None:
        with duckdb.connect() as con:
            con.execute(
                "create table ircom_rows (B varchar, C varchar, E varchar, F varchar, "
                "G varchar, H varchar, I varchar)"
            )
            con.executemany(
                "insert into ircom_rows values (?, ?, ?, ?, ?, ?, ?)",
                [
                    ("010", "001", "Total", "20", "100.5", "-1.5", "10"),
                    ("971", "101", "Total", "40", "200", "4", "12"),
                    ("754", "101", "Total", "30", "300", "3", "15"),
                    ("754", "102", "Total", "35", "n.c.", "4", "n.c."),
                    ("010", "001", "0 à 10 000", "9", "90", "0", "0"),
                ],
            )
            query = (
                (SQL / "53_local_income.sql")
                .read_text()
                .split("create or replace table commune_income as")[1]
            )
            con.execute("create table commune_income as" + query)
            self.assertEqual(
                con.execute("select * from commune_income order by insee").fetchall(),
                [
                    ("01001", 2024, 20, 10, 100500.0, -1500.0),
                    ("75056", 2024, 65, None, None, 7000.0),
                    ("97101", 2024, 40, 12, 200000.0, 4000.0),
                ],
            )

    def test_department_turnout_uses_electorate_weights(self) -> None:
        with duckdb.connect() as con:
            con.execute(
                "create table turnout_raw (source_id varchar, insee varchar, "
                "department_code varchar, registered bigint, voters bigint, abstentions bigint)"
            )
            con.execute(
                "insert into turnout_raw values ('test', '01001', '01', 100, 90, 10), "
                "('test', '01002', '01', 900, 450, 450), "
                "('test', '01003', '01', 209, 212, -3)"
            )
            con.execute((SQL / "54_local_turnout.sql").read_text())
            self.assertEqual(
                con.execute(
                    "select registered, voters, turnout, communes, excluded_communes "
                    "from department_turnout"
                ).fetchone(),
                (1000, 540, 54.0, 2, 1),
            )
            self.assertEqual(
                con.execute(
                    "select registered, voters, turnout from commune_turnout where insee = '01003'"
                ).fetchone(),
                (None, None, None),
            )


if __name__ == "__main__":
    unittest.main()
