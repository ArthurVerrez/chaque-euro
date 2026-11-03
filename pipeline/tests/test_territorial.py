import csv
import tempfile
import unittest
from pathlib import Path

import duckdb

SQL = Path(__file__).parents[1] / "sql"


class TerritorialTest(unittest.TestCase):
    def test_constituencies_keep_splits_and_mergers_without_guessing_scissions(self) -> None:
        with duckdb.connect() as con:
            con.execute(
                "create table constituency_composition "
                "(insee varchar,department_code varchar,constituency integer)"
            )
            con.execute(
                "insert into constituency_composition values "
                "('69123','69',1),('69123','69',2),('01001','01',1),"
                "('01002','01',2),('01003','01',3),('01003','01',4),('01006','01',5)"
            )
            con.execute("create table commune_passage(old_insee varchar,insee varchar)")
            con.execute(
                "insert into commune_passage values ('69123','69123'),('01001','01004'),"
                "('01002','01004'),('01003','01003'),('01003','01005')"
            )
            con.execute("create table communes(insee varchar)")
            con.execute(
                "insert into communes values ('69123'),('01004'),('01003'),('01005'),('01006')"
            )
            query = (SQL / "57_commune_constituencies.sql").read_text()
            query = query.split("create or replace table commune_constituencies as")[1]
            query = query.split("create or replace table mandate_constituencies as")[0]
            con.execute("create table commune_constituencies as" + query)
            self.assertEqual(
                con.execute(
                    "select insee,constituency from commune_constituencies order by all"
                ).fetchall(),
                [("01004", 1), ("01004", 2), ("01006", 5), ("69123", 1), ("69123", 2)],
            )

    def test_functions_preserve_rows_missing_values_and_comparable_medians(self) -> None:
        with tempfile.TemporaryDirectory() as directory, duckdb.connect() as con:
            path = Path(directory) / "functions.csv"
            fields = [
                "exer",
                "ident",
                "siren",
                "cbudg",
                "ctype",
                "nomen",
                "fonction",
                "compte",
                "obnetdeb",
            ]
            rows = [
                (2025, "budget1", "s1", 1, "101", "M57", "93211", "6411", 100),
                (2025, "budget1", "s1", 1, "101", "M57", "93211", "606", 100),
                (2025, "budget1", "s1", 1, "101", "M57", "93321", "606", 0),
                (2025, "budget1", "s1", 1, "101", "M57", "93841", "615", 40),
                (2025, "budget1", "s1", 1, "101", "M57", "", "641", 20),
                (2025, "budget1", "s1", 1, "101", "M57", "930", "641", 5),
                (2025, "budget1", "s1", 1, "101", "M57", "946", "681", 30),
                (2025, "budget1", "s1", 1, "101", "M57", "211", "211", 999),
                (2025, "annex", "s1", 3, "101", "M57", "211", "641", 999),
                (2025, "small", "small", 1, "101", "M57", "", "641", 100),
                (2025, "m14", "m14", 1, "101", "M14", "411", "641", 30),
                (2025, "paris", "paris", 1, "702", "M57", "211", "641", 99999),
                *[
                    (2025, f"budget{i}", f"s{i}", 1, "101", "M57", "211", "641", i * 100)
                    for i in range(2, 6)
                ],
                *[
                    (2025, f"budget{i}", f"s{i}", 1, "101", "M57", "311", "606", i * 100)
                    for i in range(1, 6)
                ],
            ]
            with path.open("w") as file:
                writer = csv.writer(file, delimiter=";")
                writer.writerow(fields)
                writer.writerows(rows)
            con.execute("set variable commune_functions_path = ?", [str(path)])
            con.execute("create table communes(insee varchar,siren varchar)")
            con.executemany(
                "insert into communes values (?,?)",
                [(f"0100{i}", f"s{i}") for i in range(1, 6)]
                + [("01006", "small"), ("01007", "m14"), ("75056", "paris")],
            )
            con.execute(
                "create table commune_years as select insee,2025 as year,100 as population,"
                "'1' as stratum from communes"
            )
            con.execute((SQL / "58_commune_functions.sql").read_text())
            self.assertEqual(
                con.execute(
                    "select function_code,amount,per_capita from commune_functions "
                    "where insee='01001' order by function_code"
                ).fetchall(),
                [
                    ("0", 5.0, 0.05),
                    ("2", 200.0, 2.0),
                    ("31", 100.0, 1.0),
                    ("32", 0.0, 0.0),
                    ("84", 40.0, 0.4),
                    ("unallocated", 50.0, 0.5),
                ],
            )
            self.assertEqual(
                con.execute(
                    "select count(*) from commune_functions where insee='01006'"
                ).fetchone(),
                (0,),
            )
            self.assertEqual(
                con.execute(
                    "select communes,median_per_capita from commune_function_strata "
                    "where nomenclature='M57' and function_code='2'"
                ).fetchone(),
                (6, 3.5),
            )
            self.assertEqual(
                con.execute(
                    "select communes,median_per_capita from commune_function_strata "
                    "where nomenclature='M57' and function_code='31'"
                ).fetchone(),
                (5, 3.0),
            )
            self.assertEqual(
                con.execute(
                    "select communes,median_per_capita from commune_function_strata "
                    "where nomenclature='M57' and function_code='32'"
                ).fetchone(),
                (1, None),
            )
            self.assertEqual(
                con.execute(
                    "select f.nomenclature,l.label from commune_functions f "
                    "join commune_function_labels l using(nomenclature,function_code) "
                    "where insee='01007'"
                ).fetchone(),
                ("M14", "Sport et jeunesse"),
            )


if __name__ == "__main__":
    unittest.main()
