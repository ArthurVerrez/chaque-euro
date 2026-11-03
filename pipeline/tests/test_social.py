import unittest
from pathlib import Path

import duckdb

from chaque_euro.social import ccss_rows, plfss_rows, validate

FIXTURES = Path(__file__).parent / "fixtures"


class SocialAccountsTest(unittest.TestCase):
    def test_ccss_extracts_results_forecasts_and_separate_fsv(self) -> None:
        text = (FIXTURES / "ccss-2026-branches.txt").read_text()
        rows = ccss_rows(text)
        self.assertEqual(len(rows), 138)
        self.assertIn((2025, "maladie", "Solde", -15879.0), rows)
        self.assertIn((2025, "total_fsv", "Dépenses", 666033.0), rows)
        self.assertIn((2025, "fsv", "Solde", 380.0), rows)
        self.assertFalse(any(year >= 2026 and branch == "fsv" for year, branch, _, _ in rows))
        for year in range(2022, 2028):
            balances = {
                branch: value
                for y, branch, metric, value in rows
                if y == year and metric == "Solde"
            }
            self.assertAlmostEqual(
                sum(balances[b] for b in ("maladie", "atmp", "vieillesse", "famille", "autonomie")),
                balances["total"],
                delta=3,
            )

    def test_ccss_rejects_changed_period_truncation_and_duplicate_tables(self) -> None:
        text = (FIXTURES / "ccss-2026-branches.txt").read_text()
        for changed in (text.replace("2022", "2021"), text.replace("221 320", ""), text + text):
            with self.subTest(changed=changed[:60]), self.assertRaises(ValueError):
                ccss_rows(changed)

    def test_plfss_keeps_spaced_digits_negative_balances_and_units(self) -> None:
        text = (FIXTURES / "plfss-2027-branches.txt").read_text()
        rows = plfss_rows(text)
        self.assertIn(("maladie", "Dépenses", 277100.0), rows)
        self.assertIn(("total", "Solde", -12700.0), rows)
        with self.assertRaises(ValueError):
            plfss_rows(text.replace("2 7 7 ,1", ""))
        with duckdb.connect() as con:
            con.execute(
                "create table social_pdf (source_id varchar, year integer, "
                "branch varchar, metric varchar, amount double)"
            )
            con.executemany("insert into social_pdf values ('dss-branches-2027',2027,?,?,?)", rows)
            con.execute(
                "create table social_cells "
                "(dataset varchar, line integer, col integer, value varchar)"
            )
            con.execute((Path(__file__).parents[1] / "sql/28a_social_branches.sql").read_text())
            self.assertEqual(
                con.execute(
                    "select spending,balance from social_branches where branch='total'"
                ).fetchone(),
                (696400000000.0, -12700000000.0),
            )

    def test_rejects_broken_branch_identity_and_total(self) -> None:
        rows = ccss_rows((FIXTURES / "ccss-2026-branches.txt").read_text())
        with duckdb.connect() as con:
            con.execute(
                "create table social_pdf (source_id varchar, year integer, "
                "branch varchar, metric varchar, amount double)"
            )
            con.executemany("insert into social_pdf values ('ccss-octobre-2026',?,?,?,?)", rows)
            con.execute(
                "create table social_cells "
                "(dataset varchar, line integer, col integer, value varchar)"
            )
            con.execute((Path(__file__).parents[1] / "sql/28a_social_branches.sql").read_text())
            for mutation, message in (
                (
                    "update social_branches set revenue=revenue+1e9 where branch='maladie'",
                    "branch identity",
                ),
                (
                    "update social_branches set revenue=revenue+1e9, balance=balance+1e9 "
                    "where branch='total'",
                    "branch balances versus published total",
                ),
            ):
                con.execute("begin")
                con.execute(mutation)
                with self.assertRaisesRegex(ValueError, message):
                    validate(con)
                con.execute("rollback")
