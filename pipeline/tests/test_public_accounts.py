import unittest
from pathlib import Path

import duckdb

from chaque_euro.public_accounts import validate


class PublicAccountsTest(unittest.TestCase):
    def test_parser_preserves_blocks_and_excludes_supplementary_lines(self) -> None:
        with duckdb.connect() as con:
            con.execute(
                "create table public_account_cells "
                "(filename varchar, line integer, A varchar, B varchar, C varchar)"
            )
            rows = [
                (1, "Compte (S13111)", None, None),
                (3, None, None, "2025"),
                (4, None, "DEPENSES ", None),
                (5, None, "Intérêts (D41)", "52.5"),
                (6, None, "Total des dépenses", "607.7"),
                (7, None, " dont (b) - Capitalisation (P51g)", "0.7"),
                (8, None, "RECETTES", None),
                (9, None, "Intérêts (D41)", "1.7"),
                (10, None, "Transferts de recettes fiscales (D733)", "-9.6"),
                (11, None, "Total des recettes", "479.6"),
                (12, None, "SOLDES", None),
                (13, None, "Capacité (+) ou besoin (-) de financement (B9NF)", "-128.1"),
            ]
            con.executemany(
                "insert into public_account_cells values ('test.xlsx', ?, ?, ?, ?)", rows
            )
            con.execute((Path(__file__).parents[1] / "sql/28_sector_accounts.sql").read_text())
            self.assertEqual(
                con.execute(
                    "select block, amount from public_accounts where code = 'D41' order by block"
                ).fetchall(),
                [("depenses", 52.5e9), ("recettes", 1.7e9)],
            )
            self.assertEqual(con.execute("select count(*) from public_accounts").fetchone(), (6,))
            self.assertEqual(
                con.execute("select amount from public_accounts where code = 'D733'").fetchone(),
                (-9.6e9,),
            )

    def test_cross_check_rejects_mismatched_and_missing_totals(self) -> None:
        with duckdb.connect() as con:
            con.execute(
                "create table public_finances as select 'S13111' sector, 2025 as year, "
                "607.7e9 spending, 479.6e9 revenue"
            )
            con.execute(
                "create table public_accounts as select 'S13111' sector, 2025 as year, "
                "'depenses' block, 'TOTAL' code, 607.73e9 amount "
                "union all select 'S13111', 2025, 'recettes', 'TOTAL', 479.6272e9"
            )
            validate(con)
            con.execute("update public_accounts set amount = amount + 1e8 where block = 'depenses'")
            with self.assertRaises(ValueError):
                validate(con)
            con.execute("delete from public_accounts where block = 'depenses'")
            with self.assertRaises(ValueError):
                validate(con)
