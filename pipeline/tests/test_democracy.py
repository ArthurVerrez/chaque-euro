import tempfile
import unittest
from pathlib import Path

import duckdb

from chaque_euro.democracy import _eu, _xml11_events

SQL = Path(__file__).resolve().parents[1] / "sql"


class DemocracyTest(unittest.TestCase):
    def test_legal_person_filter_and_conservative_match(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            con = duckdb.connect()
            path = str(Path(directory) / "units.parquet")
            con.execute(
                """
                copy (select * from (values
                    ('111111111', '5710', 'O'), ('222222222', '1000', 'O'),
                    ('333333333', '5710', 'P'))
                    t(siren, categorieJuridiqueUniteLegale, statutDiffusionUniteLegale))
                to ? (format parquet)
            """,
                [path],
            )
            con.execute("set variable sirene_path = ?", [path])
            con.execute("set variable lobbying_as_of = '2026-11-02'::date")
            con.execute("set variable eu_exported = '2026-11-01'")
            con.execute("""
                create table agora_organisations as select * from (values
                    ('1', 'Entreprise A', '111111111', 'SIREN', 'FRANCE', 'Société', NULL),
                    ('2', 'Personne exclue', '222222222', 'SIREN', 'FRANCE', 'Conseil', NULL),
                    ('3', 'Nom protégé', '333333333', 'SIREN', 'FRANCE', 'Société', NULL),
                    ('4', 'Association B', 'W123456789', 'RNA', 'FRANCE', 'Association', NULL))
                    t(representants_id, denomination, identifiant_national,
                      type_identifiant_national, pays, label_categorie_organisation, dateCessation);
                create table agora_exercises as select * from (values
                    ('e1', '1', '2025-01-01', '2025-12-31', '2026-03-31',
                     '2', '< 10 000 €', '0', '10000'),
                    ('e2', '2', '2025-01-01', '2025-12-31', '2026-03-31',
                     '1', '< 10 000 €', '0', '10000'))
                    t(exercices_id, representants_id, date_debut, date_fin, date_publication,
                      nombre_activites, montant_depense, montant_depense_inf, montant_depense_sup);
                create table agora_activities as select * from (values
                    ('a1', 'e1', '2026-03-31'), ('a2', 'e2', '2026-03-31'))
                    t(activite_id, exercices_id, date_publication_activite);
                create table agora_targets as select * from (values
                    ('a1', 'Agent public', NULL), ('a1', 'Agent public', NULL))
                    t(action_representation_interet_id, responsable_public,
                      departement_ministeriel);
                create table agora_defaults as select * from (values
                    ('111111111', '2025', 'Activités'), ('222222222', '2025', 'Activités'))
                    t(identifier, period, missing);
                create table orgs as select '111111111' as siren, 2 as won_count,
                    100 as won_amount, 1 as grants_count, 20 as grants_amount;
                create table eu_register_raw as select * from (values
                    ('eu1', 'ENTREPRISE-A', 'FRANCE', 'SAS', 'Companies', '2025-01-01',
                     '2025-12-31', '10000', '20000', '', '€'),
                    ('eu2', 'Personne exclue', 'FRANCE', 'Entrepreneur individuel', 'Consultants',
                     '2025-01-01', '2025-12-31', '10000', '20000', '', '€'))
                    t(id, name, country, legal_form, category, start_date, end_date,
                      cost_min, cost_max, cost_exact, currency);
                create table eu_interests_raw (id varchar, area varchar);
            """)
            con.execute((SQL / "42_lobbying.sql").read_text())
            self.assertEqual(
                con.execute("select name from lobbying_organisations order by id").fetchall(),
                [("Entreprise A",), ("Association B",)],
            )
            self.assertEqual(
                con.execute(
                    "select activities, declared_activities, activities_reconciled "
                    "from lobbying_exercises where id = 'e1'"
                ).fetchone(),
                (1, 2, False),
            )
            for table in ["lobbying_activities", "lobbying_targets", "lobbying_defaults"]:
                self.assertEqual(con.execute(f"select count(*) from {table}").fetchone(), (1,))
            self.assertEqual(
                con.execute("select siren from eu_lobbying").fetchall(), [("111111111",)]
            )
            con.execute(
                "insert into eu_register_raw select 'eu3', name, country, legal_form, category, "
                "start_date, end_date, cost_min, cost_max, cost_exact, currency "
                "from eu_register_raw where id = 'eu1'"
            )
            con.execute((SQL / "42_lobbying.sql").read_text())
            self.assertEqual(
                con.execute("select count(*) from eu_lobbying where siren is not null").fetchone(),
                (0,),
            )
            con.close()

    def test_party_alerts_require_reconciled_accounts(self) -> None:
        con = duckdb.connect()
        columns = (
            "Code_CNCCFP varchar, Nom_du_parti varchar, Unite_monetaire varchar, Exercice varchar, "
            "Cotisations_des_adherents varchar, Cotisations_des_elus varchar, "
            "Aide_publique_1ere_fraction varchar, Aide_publique_2nde_fraction varchar, "
            "Autres_aides_publiques varchar, Dons_de_personne_physique varchar, "
            '"Total_des_produits_I_+_III_+_V" varchar'
        )
        for year in range(2021, 2025):
            con.execute(f"create table party_raw_{year} ({columns})")
            con.execute(f"create table party_components_{year} (code varchar, component varchar)")
        con.execute("""
            insert into party_raw_2024 values
                ('1', 'Parti A', 'EUR', '2024', '10', '5', '60', '0', '0', '5', '100'),
                ('2', 'Parti B', 'EUR', '2024', '10', '5', '60', '0', '0', '5', '100'),
                ('3', 'Parti C', 'XPF', '2024', '10', '5', '60', '0', '0', '5', '100');
            insert into party_components_2024 values ('1', '100'), ('2', '90');
            insert into party_raw_2021 values
                ('4', 'Exercice incohérent', 'EUR', '2022', '0', '0', '60', '0', '0', '0', '100');
            insert into party_components_2022 values ('4', '100');
            create table party_status_raw (code varchar, name varchar, decision varchar,
                reason varchar, aid_loss_until varchar);
            insert into party_status_raw values
                ('1', 'Parti A', 'Non-respect', 'AD', ''),
                ('2', 'Parti B', 'Non-respect', 'AD', '01/01/2028');
        """)
        con.execute((SQL / "43_political_finance.sql").read_text())
        self.assertEqual(
            con.execute(
                "select code, majority_public from party_accounts order by code"
            ).fetchall(),
            [("1", True), ("2", False)],
        )
        self.assertEqual(con.execute("select code from party_aid_losses").fetchall(), [("2",)])
        con.close()

    def test_xml11_control_reference_and_truncation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "register.xml"
            path.write_text("<?xml version='1.1'?><root><name>A&#x1;B &amp; C</name></root>")
            names = [e.text for e in _xml11_events(path) if e.tag == "name"]
            self.assertEqual(names, ["AB & C"])
            path.write_text(
                "<root><metaData><numberOfIR>2</numberOfIR></metaData>"
                "<interestRepresentative/></root>"
            )
            con = duckdb.connect()
            with self.assertRaisesRegex(ValueError, "expected 2, read 1"):
                _eu(con, path)
            con.close()


if __name__ == "__main__":
    unittest.main()
