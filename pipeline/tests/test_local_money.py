import unittest
from pathlib import Path

import duckdb

SQL = Path(__file__).parents[1] / "sql"


class LocalMoneyTest(unittest.TestCase):
    def test_income_units_geography_merged_communes_and_fiscal_secrecy(self) -> None:
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
                    ("010", "002", "Total", "5", "50", "1", "2"),
                ],
            )
            con.execute(
                "create table commune_code_map as select '01002' as old_insee, '01001' as insee"
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
                    ("01001", 2024, 25, 12, 150500.0, -500.0),
                    ("75056", 2024, 65, None, None, 7000.0),
                    ("97101", 2024, 40, 12, 200000.0, 4000.0),
                ],
            )

    def test_department_turnout_uses_electorate_weights_and_merged_communes(self) -> None:
        with duckdb.connect() as con:
            con.execute(
                "create table turnout_raw (source_id varchar, insee varchar, "
                "department_code varchar, registered bigint, voters bigint, abstentions bigint)"
            )
            con.execute(
                "insert into turnout_raw values ('test', '01001', '01', 100, 90, 10), "
                "('test', '01002', '01', 900, 450, 450), "
                "('test', '01003', '01', 209, 212, -3), "
                "('test', '01004', '01', 100, 50, 50), ('test', '01005', '01', 100, 70, 30)"
            )
            con.execute(
                "create table commune_code_map as select '01004' as old_insee, '01005' as insee"
            )
            con.execute((SQL / "54_local_turnout.sql").read_text())
            self.assertEqual(
                con.execute(
                    "select registered, voters, turnout, communes, excluded_communes "
                    "from department_turnout"
                ).fetchone(),
                (1200, 660, 55.0, 3, 1),
            )
            self.assertEqual(
                con.execute(
                    "select registered, voters, turnout from commune_turnout where insee = '01005'"
                ).fetchone(),
                (200, 120, 60.0),
            )
            self.assertEqual(
                con.execute(
                    "select registered, voters, turnout from commune_turnout where insee = '01003'"
                ).fetchone(),
                (None, None, None),
            )

    def test_merged_commune_keeps_the_rate_of_the_commune_that_kept_its_code(self) -> None:
        with duckdb.connect() as con:
            con.execute(
                "create macro rei_number(value) as "
                "try_cast(replace(trim(value), ',', '.') as double)"
            )
            con.execute(
                "create table rei_rate_history as select * from (values "
                "('93', '066', 2024, '39,02', '0', '0'), ('93', '059', 2024, '45,1', '0', '0'), "
                "('01', '001', 2024, '20', '1', '2')) "
                "t(dep, com, year, commune, syndicate, grouping)"
            )
            con.execute(
                "create table rei_rows as select * from (values "
                "('93066', '93066', '39,5', '0', '0'), ('93066', '93059', '44', '0', '0'), "
                "('01001', '01001', '21', '1', '2')) t(insee, code, E12, E22, E32)"
            )
            con.execute(
                "create table commune_code_map as select * from (values "
                "('93066', '93066'), ('93059', '93066'), ('01001', '01001')) t(old_insee, insee)"
            )
            con.execute((SQL / "52a_tax_rates.sql").read_text())
            self.assertEqual(
                con.execute(
                    "select insee, year, commune_rate from commune_tax_rates order by insee, year"
                ).fetchall(),
                [
                    ("01001", 2024, 20.0),
                    ("01001", 2025, 21.0),
                    ("93066", 2024, 39.02),
                    ("93066", 2025, 39.5),
                ],
            )

    def test_base_revaluation_follows_november_harmonised_prices(self) -> None:
        with duckdb.connect() as con:
            con.execute(
                "create table ipch_raw as select * from (values ('2021-11', 109.09), "
                "('2022-10', 115.0), ('2022-11', 116.81), ('2024-11', 123.36), "
                "('2025-11', 124.33)) t(period, value)"
            )
            con.execute((SQL / "52b_base_revaluation.sql").read_text())
            self.assertEqual(
                con.execute("select * from property_base_revaluation order by year").fetchall(),
                [(2023, 1.071), (2026, 1.008)],
            )


if __name__ == "__main__":
    unittest.main()
