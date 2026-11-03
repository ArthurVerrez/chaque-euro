import gzip
import tempfile
import unittest
from pathlib import Path

import duckdb

from chaque_euro.national import _csv, validate

SQL = Path(__file__).parents[1] / "sql"


class NationalAccountsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.con = duckdb.connect()
        self.addCleanup(self.con.close)
        self.con.execute("""
            create table state_monthly as select 2026 as year, 8 as month,
                300.0 spending, 220.0 revenue, -150.0 balance,
                50.0 transfers, 5.0 funds, -25.0 special, 0.0 annex;
            create table monthly_totals as select 2026 as year, 8 as month,
                300.0 spending, 300.0 spending_parts, 220.0 revenue, 220.0 revenue_parts;
            create table title_programmes as select '105' programme_code, 100.0 amount;
            create table budget as select '105' programme_code, 100.0 spent
                union all select '551', 0.0;
            create table ministry_codes as select '105' programme_code,
                'Affaires étrangères' ministry;
            create table state_titles as select 2025 as year, 100.0 amount;
            create table state_ministries as select 2025 as year, 100.0 amount;
            create table state_assets as select 2025 as year, 100.0 assets, 300.0 liabilities,
                -200.0 net_position, 180.0 net_accounts, 50.0 charges, 30.0 products;
            create table compulsory_levies
                (block varchar, code varchar, year integer, amount double);
            insert into compulsory_levies values
                ('beneficiary','TOTAL',2025,100e9), ('beneficiary','S1311',2025,30e9),
                ('beneficiary','S13111',2025,28e9), ('beneficiary','S13112',2025,2e9),
                ('beneficiary','S1313',2025,20e9), ('beneficiary','S1314',2025,48e9),
                ('beneficiary','S212',2025,2e9), ('tax','TOTAL',2025,100e9);
            create table social_benefits as select 2024 as year, 'TOTAL' risk, 100e9 amount
                union all select 2024, 'Santé', 40e9 union all select 2024, 'Autres', 60e9;
            create table european_finances as select 'FR' geo, 2025 as year,
                57.0 spending, 52.0 revenue, -5.0 balance;
            create table european_functions as select 'FR' geo, 2025 as year,
                'GF' || lpad(i::varchar,2,'0') as function, 5.7 spending from range(1,11) t(i);
            create table quarterly_debt as select '2026-Q2' period, 3400e9 amount;
            create table green_budget as select 'Favorable' rating, 30e9 amount;
        """)

    def test_accounting_identities_allow_voted_but_unused_programmes(self) -> None:
        validate(self.con)

    def test_rejects_inconsistent_figures_and_missing_ministry_mapping(self) -> None:
        for mutation in (
            "update state_monthly set balance=-80",
            "update monthly_totals set spending_parts=301.1",
            "update title_programmes set amount=101.1",
            "delete from ministry_codes",
            "update state_ministries set amount=102.0",
            "update state_assets set net_position=-180",
            "update compulsory_levies set amount=31e9 where code='S1311'",
            "update compulsory_levies set amount=99e9 where block='tax'",
            "update social_benefits set amount=99e9 where risk='TOTAL'",
            "update european_finances set balance=-4.0",
            "delete from european_functions where function='GF10'",
        ):
            with self.subTest(mutation=mutation):
                self.con.execute("begin")
                self.con.execute(mutation)
                with self.assertRaises(ValueError):
                    validate(self.con)
                self.con.execute("rollback")

    def test_compressed_utf16_monthly_source_keeps_euro_units_and_months(self) -> None:
        header = (
            "Niveau hiérarchique;Niveau hiérarchique de la ligne;Catégorie;"
            "Sous-catégorie;Ligne d'information;31/08/2026\n"
        )
        content = (
            header + "0;Nul;Solde budgétaire;Solde budgétaire;Solde budgétaire;-159603646599,08\n"
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "monthly.csv"
            path.write_bytes(gzip.compress(content.encode("utf-16")))
            _csv(self.con, "monthly_raw", str(path))
        self.con.execute((SQL / "25a_state_monthly.sql").read_text())
        self.assertEqual(
            self.con.execute("select year,month,balance from state_monthly").fetchone(),
            (2026, 8, -159603646599.08),
        )
