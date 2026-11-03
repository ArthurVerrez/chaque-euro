import sqlite3
import tempfile
import unittest
from pathlib import Path

import duckdb

from chaque_euro.procurement import buyer_ids, estimate_range

SQL = Path(__file__).resolve().parents[1] / "sql"


class PublicationQualityTests(unittest.TestCase):
    def test_initial_versions_calendar_months_and_denominators(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            con = duckdb.connect()
            path = str(Path(directory) / "decp.parquet")
            con.execute("""
                create table sample (
                    uid varchar, dateNotification date, datePublicationDonnees date,
                    montant double, montant_anomalie varchar, modification_id integer
                );
                insert into sample values
                    ('on-time', '2024-07-01', '2024-09-01', 40000, null, 0),
                    ('late', '2024-07-01', '2024-09-02', 40000, null, 0),
                    ('missing-date', '2024-07-01', null, 40000, null, 0),
                    ('before', '2024-07-01', '2024-06-30', 40000, null, 0),
                    ('small', '2024-07-01', '2024-07-02', 39999, null, 0),
                    ('flagged', '2024-07-01', '2024-07-02', 40000, 'suspect', 0),
                    ('cap', '2024-07-01', '2024-07-02', 999999999, null, 0),
                    ('recent', '2024-12-01', '2024-12-02', 40000, null, 0),
                    ('modified', '2024-07-01', '2024-09-02', 40000, null, 0),
                    ('modified', '2024-11-01', '2024-11-01', 40000, null, 1),
                    ('no-original', '2024-07-01', '2024-07-01', 40000, null, 1);
                create table contract_rows as
                    select distinct uid, '123456789' as buyer_siren from sample;
                create table identities as select '123456789' as siren, '72' as legal_category;
                create macro org_kind(category) as 'Collectivité territoriale';
            """)
            con.execute("copy sample to ? (format parquet)", [path])
            con.execute("set variable decp_path = ?", [path])
            con.execute("set variable decp_retrieved_on = date '2024-12-31'")
            con.execute((SQL / "42_procurement_quality.sql").read_text())
            self.assertEqual(
                con.execute(
                    "select total, eligible, valid, on_time from procurement_quality"
                ).fetchone(),
                (9, 5, 3, 1),
            )


class ContractDatingTests(unittest.TestCase):
    def test_amendment_keeps_original_notification_and_amount_filters(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            con = duckdb.connect()
            path = str(Path(directory) / "decp.parquet")
            con.execute("""
                create table sample as
                select 'contract' as uid, 'Objet' as objet, 'Marché' as nature,
                    'Ouverte' as procedure, '123' as codeCPV,
                    date '2024-01-01' as dateNotification, 40000.0 as montant,
                    null::varchar as montant_anomalie, '12345678900012' as acheteur_id,
                    '98765432100012' as titulaire_id, null::varchar as titulaire_activite_libelle,
                    'source' as sourceFile, 0 as modification_id, false as donneesActuelles,
                    null::double as montant_rationalise, 1 as offresRecues
                union all
                select 'contract', 'Objet modifié', 'Marché', 'Ouverte', '123',
                    date '2023-12-01', 999999999.0, null, '12345678900012',
                    '98765432100012', null, 'source', 1, true, null, 1;
            """)
            con.execute("alter table sample add column datePublicationDonnees date")
            con.execute("copy sample to ? (format parquet)", [path])
            con.execute("set variable decp_path = ?", [path])
            con.execute("set variable decp_retrieved_on = date '2024-12-31'")
            con.execute((SQL / "10_contracts.sql").read_text())
            self.assertEqual(
                con.execute("select notified_on::varchar, subject from contract_rows").fetchone(),
                ("2024-01-01", "Objet modifié"),
            )
            self.assertEqual(
                con.execute("select counted, amount_flag from contract_amounts").fetchone(),
                (False, "hors_norme"),
            )


class BoampBuyerTests(unittest.TestCase):
    def test_identifies_buyer_without_using_contact_or_supplier_ids(self) -> None:
        def company(ref: str, identifier: str) -> dict[str, object]:
            return {
                "efac:Company": {
                    "cac:PartyIdentification": {"cbc:ID": {"#text": ref}},
                    "cac:PostalAddress": {
                        "cac:Country": {"cbc:IdentificationCode": {"#text": "FRA"}}
                    },
                    "cac:PartyLegalEntity": [{"cbc:CompanyID": {"#text": identifier}}],
                }
            }

        notice = {
            "cac:ContractingParty": {
                "cac:Party": {"cac:PartyIdentification": {"cbc:ID": {"#text": "ORG-1"}}}
            },
            "ext:UBLExtensions": {
                "ext:UBLExtension": {
                    "ext:ExtensionContent": {
                        "efext:EformsExtension": {
                            "efac:Organizations": {
                                "efac:Organization": [
                                    company("ORG-1", "12345678900012"),
                                    company("ORG-2", "98765432100012"),
                                ]
                            }
                        }
                    }
                }
            },
        }
        self.assertEqual(buyer_ids({"EFORMS": {"ContractNotice": notice}}), {"123456789"})
        company_data = notice["ext:UBLExtensions"]["ext:UBLExtension"]["ext:ExtensionContent"][
            "efext:EformsExtension"
        ]["efac:Organizations"]["efac:Organization"][0]["efac:Company"]
        company_data["cac:PostalAddress"]["cac:Country"]["cbc:IdentificationCode"]["#text"] = "BEL"
        self.assertEqual(buyer_ids({"EFORMS": {"ContractNotice": notice}}), set())
        self.assertEqual(
            buyer_ids({"FNSimple": {"organisme": {"codeIdentificationNational": "invalid"}}}), set()
        )


class BoampEstimateTests(unittest.TestCase):
    def test_preserves_both_bounds_and_open_ranges_without_a_midpoint(self) -> None:
        value = {"@devise": "EUR", "fourchette": {"valeurBasse": "100", "valeurHaute": "300"}}
        data = {"FNSimple": {"initial": {"natureMarche": {"valeurEstimee": value}}}}
        self.assertEqual(estimate_range(data), "100 à 300 EUR HT")
        value["fourchette"] = {"valeurHaute": "300"}
        self.assertEqual(estimate_range(data), "Jusqu\u2019à 300 EUR HT")
        value["fourchette"] = {"valeurBasse": "100"}
        self.assertEqual(estimate_range(data), "Au moins 100 EUR HT")
        value["fourchette"] = {"valeurBasse": "300", "valeurHaute": "100"}
        self.assertIsNone(estimate_range(data))
        value["fourchette"] = {"valeurHaute": "NaN"}
        self.assertIsNone(estimate_range(data))


class OpportunityDateTests(unittest.TestCase):
    def test_deadline_round_trips_through_sqlite_with_utc_offset(self) -> None:
        con = duckdb.connect()
        con.execute("""
            set variable procurement_as_of = date '2026-11-02';
            create table boamp_input as
            select 'notice' as id, 'Objet' as subject, date '2026-11-01' as published_on,
                timestamptz '2026-11-03 12:00:00+01:00' as deadline,
                'Ouverte' as procedure, '123456789' as buyer_id, null::varchar as estimated_range;
            create table identities as
            select '123456789' as siren, true as public, 'Acheteur public' as label;
            create table approch_input (
                code integer, libelle varchar, date_previsionnelle_de_publication date,
                categorie_d_achat varchar, type_de_procedure varchar,
                montant_estime_du_marche varchar, siren_de_l_entite_acheteuse bigint,
                statut varchar
            );
        """)
        con.execute((SQL / "43_procurement_opportunities.sql").read_text())
        row = con.execute("select deadline from procurement_notices").fetchone()
        self.assertEqual(row, ("2026-11-03T11:00:00Z",))
        db = sqlite3.connect(":memory:")
        self.assertEqual(
            db.execute("select julianday(?) > julianday('2026-11-02')", [row[0]]).fetchone(),
            (1,),
        )
        db.close()


class ProcurementAmountTests(unittest.TestCase):
    def test_flagged_amounts_keep_estimates_but_are_not_counted(self) -> None:
        with tempfile.TemporaryDirectory() as directory, duckdb.connect() as con:
            path = str(Path(directory) / "sample.parquet")
            con.execute("""
                create table sample as
                select uid, declared as montant, estimate as montant_rationalise,
                    flag as montant_anomalie, 'Objet' as objet, 'Marché' as nature,
                    'Ouverte' as procedure, '45000000' as codeCPV,
                    date '2024-01-01' as dateNotification, '12345678900012' as acheteur_id,
                    '98765432100012' as titulaire_id, null::varchar as titulaire_activite_libelle,
                    'source' as sourceFile, 0 as modification_id, true as donneesActuelles,
                    1 as offresRecues
                from (values ('clean', 50000.0, null, null),
                    ('estimated', 5000000000.0, 200000.0, 'aberrant'),
                    ('suspect', 90000.0, 90000.0, 'suspect'),
                    ('no-estimate', 5000000000.0, null, 'aberrant'),
                    ('unflagged-cap', 999999999.0, 1000.0, null))
                    v(uid, declared, estimate, flag);
            """)
            con.execute("alter table sample add column datePublicationDonnees date")
            con.execute("update sample set modification_id=2, datePublicationDonnees='2024-07-01'")
            con.execute("""
                insert into sample select * replace (
                    '11111111100012' as titulaire_id, 0 as modification_id,
                    100000.0 as montant_rationalise, date '2024-06-01' as datePublicationDonnees
                ) from sample where uid='estimated';
                insert into sample select * replace (
                    150000.0 as montant_rationalise, date '2024-06-01' as datePublicationDonnees
                ) from sample where uid='estimated' and modification_id=2;
            """)
            con.execute("copy sample to ? (format parquet)", [path])
            con.execute("set variable decp_path = ?", [path])
            con.execute("set variable decp_retrieved_on = date '2024-12-31'")
            con.execute((SQL / "10_contracts.sql").read_text())
            self.assertEqual(
                con.execute(
                    "select holders from contract_amounts where uid='estimated'"
                ).fetchone(),
                (2,),
            )
            expected = con.execute("select * from contract_amounts order by uid").fetchall()
            con.execute("set threads=1")
            con.execute((SQL / "10_contracts.sql").read_text())
            self.assertEqual(
                con.execute("select * from contract_amounts order by uid").fetchall(), expected
            )
            self.assertEqual(
                con.execute(
                    "select uid, amount, declared_amount, amount_estimated, counted "
                    "from contract_amounts order by uid"
                ).fetchall(),
                [
                    ("clean", 50000.0, 50000.0, False, True),
                    ("estimated", 200000.0, 5000000000.0, True, False),
                    ("no-estimate", None, 5000000000.0, False, False),
                    ("suspect", 90000.0, 90000.0, False, False),
                    ("unflagged-cap", 999999999.0, 999999999.0, False, False),
                ],
            )


class ProcurementCompetitionTests(unittest.TestCase):
    def test_denominator_deduplicates_holders_and_excludes_unknown_or_conflicting_counts(
        self,
    ) -> None:
        with duckdb.connect() as con:
            con.execute("""
                create table contract_rows as
                select uid, buyer as buyer_siren, notified::date as notified_on, cpv, offers
                from (values
                    ('a','111111111','2024-01-01','45000000',1),
                    ('a','111111111','2024-01-01','45000000',1),
                    ('b','111111111','2024-01-01','45000000',2),
                    ('c','111111111','2024-01-01','72000000',0),
                    ('d','111111111','2024-01-01','72000000',null),
                    ('e','111111111','2024-01-01','72000000',1),
                    ('e','111111111','2024-01-01','72000000',2),
                    ('f','111111111','2023-01-01','45000000',1),
                    ('g','222222222','2024-01-01','45000000',1))
                    v(uid,buyer,notified,cpv,offers);
                create table identities as select '111111111' as siren, true as public
                    union all select '222222222', false;
            """)
            con.execute((SQL / "45_procurement_competition.sql").read_text())
            self.assertEqual(
                con.execute(
                    "select total,known,single_bid from procurement_competition "
                    "where dimension='national'"
                ).fetchone(),
                (6, 3, 2),
            )
            self.assertEqual(
                con.execute(
                    "select total,known,single_bid from procurement_competition "
                    "where dimension='buyer' and label='111111111'"
                ).fetchone(),
                (5, 2, 1),
            )
            self.assertEqual(
                con.execute(
                    "select total,known,single_bid from procurement_competition "
                    "where dimension='sector' and label='45'"
                ).fetchone(),
                (3, 3, 2),
            )
            self.assertFalse(
                con.execute(
                    "select 1 from procurement_competition where label='222222222'"
                ).fetchone()
            )
