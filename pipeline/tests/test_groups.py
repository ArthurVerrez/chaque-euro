import tempfile
import unittest
from pathlib import Path

import duckdb

from chaque_euro.groups import gares_identifier, sncf_subsidiaries

SQL = Path(__file__).resolve().parents[1] / "sql"


class GroupEvidenceTests(unittest.TestCase):
    def test_only_official_subsidiaries_and_majority_interests(self) -> None:
        identifiers = ["412280737", "519037584", *[f"12345678{n}" for n in range(8)]]
        table = "\n".join(f"{siren} SOCIETE  100%  10" for siren in identifiers)
        text = (
            "28. Filiales et participations\nN°SIREN\n"
            "I. Renseignements concernant les filiales\n"
            f"{table}\n111111111 MINORITAIRE 19%\n"
            "II. Renseignements concernant les participations\n222222222 AUTRE 25%"
        )
        self.assertEqual(sncf_subsidiaries(text), identifiers)
        with self.assertRaises(ValueError):
            sncf_subsidiaries(text.replace("28. Filiales", "29. Filiales"))

    def test_gares_identifier_must_be_in_its_official_legal_identity(self) -> None:
        identity = (
            "SNCF Gares & Connexions, SA au capital social de 213 710 030 euros, "
            "immatriculée au RCS de Paris sous le numéro 507 523 801"
        )
        self.assertEqual(gares_identifier(identity), "507523801")
        with self.assertRaises(ValueError):
            gares_identifier(identity.replace("507 523 801", "507 523 802"))
        with self.assertRaises(ValueError):
            gares_identifier("507 523 801 Autre société")


class GroupSqlTests(unittest.TestCase):
    def test_identifiers_privacy_and_parent_chain(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            con = duckdb.connect()
            con.execute("""
                create table sample (
                    siren varchar, denominationUniteLegale varchar,
                    categorieJuridiqueUniteLegale varchar,
                    etatAdministratifUniteLegale varchar,
                    statutDiffusionUniteLegale varchar
                );
                insert into sample values
                    ('552049447', 'SOCIETE MERE', '5599', 'A', 'O'),
                    ('412280737', 'FILIALE', '5599', 'A', 'O'),
                    ('507523801', 'SOUS-FILIALE', '5599', 'A', 'O'),
                    ('111111111', 'PERSONNE PRIVEE', '1000', 'A', 'O'),
                    ('222222222', 'NOM SECRET', '5599', 'A', 'P'),
                    ('333333333', 'ENFANT DU SECRET', '5599', 'A', 'O'),
                    ('444444444', 'SOCIETE MERE SNCF', '5599', 'A', 'O'),
                    ('555555555', '[ND]', '5599', 'A', 'O');
                create table organisation_group_input as
                select '552049447' as group_siren, siren,
                    case when siren = '552049447' then null
                        when siren = '507523801' then '412280737'
                        when siren = '333333333' then '222222222'
                        else '552049447' end as parent_siren,
                    'official' as source_id, 'p. 1' as source_ref,
                    'official' as identifier_source_id, 'p. 1' as identifier_ref,
                    date '2025-12-31' as as_of
                from sample where siren <> '444444444';
                create macro org_kind(category) as 'Société commerciale';
            """)
            path = str(Path(directory) / "sirene.parquet")
            con.execute("copy sample to ? (format parquet)", [path])
            con.execute("set variable sirene_path = ?", [path])
            con.execute((SQL / "38_organisation_groups.sql").read_text())
            self.assertEqual(
                con.execute("select siren from org_group_members order by siren").fetchall(),
                [("412280737",), ("507523801",), ("552049447",)],
            )

    def test_measures_years_shares_and_missing_amounts_stay_separate(self) -> None:
        con = duckdb.connect()
        con.execute("""
            create table org_group_members as
            select 'group' as group_siren, unnest(['a','b','c']) as siren;
            create table holder_shares (
                holder_siren varchar, holder_public boolean, year integer, share double,
                counted boolean, amount_estimated boolean
            );
            insert into holder_shares values
                ('a', true, 2025, 50, true, false),
                ('b', true, 2025, 50, true, true),
                ('a', true, 2024, 900, true, false),
                ('a', true, 2025, null, false, false),
                ('c', true, 2025, null, false, false),
                ('unlisted', true, 2025, 2000, true, false),
                ('b', false, 2025, 3000, true, false);
            create table buyer_contracts as
            select 'a' as buyer_siren, 2025 as year, 300.0 as amount,
                true as counted, false as amount_estimated;
            create table grants as
            select 'b' as siren, 2024 as year, 500.0 as amount;
        """)
        con.execute((SQL / "40a_organisation_group_amounts.sql").read_text())
        self.assertEqual(
            con.execute("""
                select measure, year, sum(amount), sum(unpriced), sum(estimated)
                from org_group_amounts group by all order by measure, year
            """).fetchall(),
            [
                ("acheteur", 2025, 300, 0, 0),
                ("titulaire", 2024, 900, 0, 0),
                ("titulaire", 2025, 100, 2, 1),
                ("versement", 2024, 500, 0, 0),
            ],
        )
        self.assertIsNone(
            con.execute("select amount from org_group_amounts where siren = 'c'").fetchone()[0]
        )
        self.assertEqual(
            con.execute("""
                select count(*) from org_group_amounts
                where measure = 'versement' and year = 2025
            """).fetchone(),
            (0,),
        )
