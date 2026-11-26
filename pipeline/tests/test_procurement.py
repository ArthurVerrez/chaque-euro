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
                select 'contract' as uid, 'contract' as id, 'Objet' as objet, 'Marché' as nature,
                    'Ouverte' as procedure, '123' as codeCPV,
                    date '2024-01-01' as dateNotification, 40000.0 as montant,
                    null::varchar as montant_anomalie, '12345678900012' as acheteur_id,
                    '98765432100012' as titulaire_id, null::varchar as titulaire_activite_libelle,
                    'source' as sourceFile, 'feed' as sourceDataset, 0 as modification_id,
                    false as donneesActuelles,
                    null::double as montant_rationalise, 1 as offresRecues
                union all
                select 'contract', 'contract', 'Objet modifié', 'Marché', 'Ouverte', '123',
                    date '2023-12-01', 999999999.0, null, '12345678900012',
                    '98765432100012', null, 'source', 'feed', 1, true, null, 1;
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

    def test_same_contract_from_several_feeds_counts_once(self) -> None:
        with tempfile.TemporaryDirectory() as directory, duckdb.connect() as con:
            path = str(Path(directory) / "decp.parquet")
            con.execute("""
                create table sample as
                select uid, uid as id, 'Objet' as objet, 'Marché' as nature,
                    'Ouverte' as procedure, '123' as codeCPV,
                    notified::date as dateNotification, amount as montant,
                    null::varchar as montant_anomalie, '12345678900012' as acheteur_id,
                    '98765432100012' as titulaire_id, null::varchar as titulaire_activite_libelle,
                    'source' as sourceFile, feed as sourceDataset, 0 as modification_id,
                    true as donneesActuelles, null::double as montant_rationalise,
                    1 as offresRecues, published::date as datePublicationDonnees
                from (values ('a', 'feed1', '2023-12-21', 200000.0, '2024-02-09'),
                    ('b', 'feed2', '2023-12-21', 200000.0, '2024-02-09'),
                    ('c', 'feed3', '2023-12-21', 200000.0, '2024-05-22'),
                    ('lot1', 'feed1', '2024-03-01', 50000.0, '2024-04-01'),
                    ('lot2', 'feed1', '2024-03-01', 50000.0, '2024-04-01'),
                    ('lot1-copy', 'feed2', '2024-03-01', 50000.0, '2024-04-01'),
                    ('later', 'feed2', '2024-06-01', 200000.0, '2024-07-01'))
                    v(uid, feed, notified, amount, published);
            """)
            con.execute("copy sample to ? (format parquet)", [path])
            con.execute("set variable decp_path = ?", [path])
            con.execute("set variable decp_retrieved_on = date '2024-12-31'")
            con.execute((SQL / "10_contracts.sql").read_text())
            self.assertEqual(
                con.execute("select uid from contract_amounts order by uid").fetchall(),
                [("c",), ("later",), ("lot1",), ("lot2",)],
            )

    def test_republished_amendment_chain_counts_once_but_lots_stay_apart(self) -> None:
        with tempfile.TemporaryDirectory() as directory, duckdb.connect() as con:
            path = str(Path(directory) / "decp.parquet")
            con.execute("""
                create table sample as
                select id || '_cpv' as uid, id, subject as objet, 'Marché' as nature,
                    'Ouverte' as procedure, '123' as codeCPV,
                    date '2019-10-30' as dateNotification, amount as montant,
                    null::varchar as montant_anomalie, '12345678900012' as acheteur_id,
                    '98765432100012' as titulaire_id, null::varchar as titulaire_activite_libelle,
                    'source' as sourceFile, feed as sourceDataset, version as modification_id,
                    true as donneesActuelles, null::double as montant_rationalise,
                    1 as offresRecues, published::date as datePublicationDonnees
                from (values
                    ('201910800', 'decp_colmo', 'Mission MOE', 600000.0, 0, '2020-06-05'),
                    ('201910801', 'pes_marche_legacy', 'Mission MOE', 700000.0, 1, '2021-01-01'),
                    ('201910802', 'pes_marche_legacy', 'MISSION MOE', 800000.0, 2, null),
                    ('201910803', 'pes_marche_legacy', 'Mission MOE lot 2', 90000.0, 1,
                        '2021-01-01'),
                    ('20243267', 'scrap_marches-publics.info', 'Travaux', 129483.6, 1,
                        '2024-09-05'),
                    ('20243268', 'scrap_marches-publics.info', 'Travaux', 630175.0, 1,
                        '2024-09-05'))
                    v(id, feed, subject, amount, version, published);
            """)
            con.execute("copy sample to ? (format parquet)", [path])
            con.execute("set variable decp_path = ?", [path])
            con.execute("set variable decp_retrieved_on = date '2024-12-31'")
            con.execute((SQL / "10_contracts.sql").read_text())
            self.assertEqual(
                con.execute("select uid, amount from contract_amounts order by uid").fetchall(),
                [
                    ("201910802_cpv", 800000.0),
                    ("201910803_cpv", 90000.0),
                    ("20243267_cpv", 129483.6),
                    ("20243268_cpv", 630175.0),
                ],
            )

    def test_copies_across_feeds_and_shared_ceilings_count_once(self) -> None:
        with tempfile.TemporaryDirectory() as directory, duckdb.connect() as con:
            path = str(Path(directory) / "decp.parquet")
            con.execute("""
                create table sample as
                select uid, uid as id, subject as objet, 'Marché' as nature,
                    'Ouverte' as procedure, '123' as codeCPV,
                    notified::date as dateNotification, amount as montant,
                    null::varchar as montant_anomalie, '12345678900012' as acheteur_id,
                    holder as titulaire_id, null::varchar as titulaire_activite_libelle,
                    'source' as sourceFile, feed as sourceDataset, version as modification_id,
                    true as donneesActuelles, null::double as montant_rationalise,
                    1 as offresRecues, published::date as datePublicationDonnees
                from (values
                    ('202339900', 'pes_marche_legacy', 'Nettoyage', '2023-03-10', 1400000.0,
                        '11111111100011', 0, '2023-06-08'),
                    ('2023399', 'pes_marche_2024', 'NETTOYAGE', '2022-01-01', 1500000.0,
                        '11111111100011', 1, '2026-10-12'),
                    ('20240036', 'aws_marches-publics.info', 'Réactifs', '2024-05-03',
                        60837.38, '22222222200022', 0, '2024-06-01'),
                    ('2024003600', 'scrap_marches-publics.info', 'Réactifs', '2024-05-03',
                        60837.38, null, 0, '2024-06-02'),
                    ('S1', 'atexo', 'Système acquisition', '2023-12-20', 485250000.0,
                        '33333333300033', 0, '2024-07-07'),
                    ('S2', 'atexo', 'Système acquisition', '2023-12-20', 485250000.0,
                        '44444444400044', 0, '2024-07-07'),
                    ('S3', 'atexo', 'Système acquisition', '2024-01-05', 485250000.0,
                        '33333333300033', 0, '2025-02-01'),
                    ('L1', 'atexo', 'Lots', '2024-03-01', 50000.0, '55555555500055', 0,
                        '2024-04-01'),
                    ('L2', 'atexo', 'Lots', '2024-03-01', 50000.0, '55555555500055', 0,
                        '2024-04-01'),
                    ('V1', 'atexo', 'TVA', '2024-03-01', 70000.0, 'FR15535340285', 0,
                        '2024-04-01'),
                    ('N1', 'atexo', 'Sans plafond', '2024-03-01', 9999999.0,
                        '66666666600066', 0, '2024-04-01'))
                    v(uid, feed, subject, notified, amount, holder, version, published);
            """)
            con.execute("copy sample to ? (format parquet)", [path])
            con.execute("set variable decp_path = ?", [path])
            con.execute("set variable decp_retrieved_on = date '2026-11-26'")
            con.execute((SQL / "10_contracts.sql").read_text())
            self.assertEqual(
                con.execute("""
                    select uid, any_value(notified_on)::varchar, list_sort(list(holder_siren)),
                        any_value(a.amount), any_value(a.counted)
                    from contract_rows join contract_amounts a using (uid)
                    group by uid order by uid
                """).fetchall(),
                [
                    ("2023399", "2023-03-10", ["111111111"], 1500000.0, True),
                    ("20240036", "2024-05-03", ["222222222"], 60837.38, True),
                    ("L1", "2024-03-01", ["555555555"], 50000.0, True),
                    ("L2", "2024-03-01", ["555555555"], 50000.0, True),
                    ("N1", "2024-03-01", ["666666666"], 9999999.0, False),
                    ("S1", "2023-12-20", ["333333333", "444444444"], 485250000.0, True),
                    ("V1", "2024-03-01", ["535340285"], 70000.0, True),
                ],
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
                select uid, uid as id, declared as montant, estimate as montant_rationalise,
                    flag as montant_anomalie, uid as objet, 'Marché' as nature,
                    'Ouverte' as procedure, '45000000' as codeCPV,
                    date '2024-01-01' as dateNotification, '12345678900012' as acheteur_id,
                    '98765432100012' as titulaire_id, null::varchar as titulaire_activite_libelle,
                    'source' as sourceFile, 'feed' as sourceDataset, 0 as modification_id,
                    true as donneesActuelles, 1 as offresRecues
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


class OrganisationOrderingTests(unittest.TestCase):
    def test_selections_labels_and_identifiers_ignore_input_order_and_new_contracts(self) -> None:
        with duckdb.connect() as con:
            con.execute("""
                create table contract_rows as
                select 'c' || lpad(i::varchar, 2, '0') as uid,
                    'b' || lpad(i::varchar, 2, '0') as buyer_siren,
                    'holder' as holder_siren, date '2025-01-01' as notified_on,
                    'Z' as subject, case when i < 6 then 'Z' else 'A' end as holder_activity,
                    'source-z' as source_url
                from range(12) t(i);
                insert into contract_rows select contract_rows.* replace (
                    'other' || i as holder_siren, 'A' as subject,
                    null as holder_activity, 'source-a' as source_url
                ) from contract_rows cross join range(8) t(i) where uid = 'c00';
                create table contract_amounts as
                select uid, count(*) as holders, 10.0 as amount, 10.0 as declared_amount,
                    null::varchar as amount_flag, false as amount_estimated, true as counted
                from contract_rows group by uid;
                create table identities as
                select siren, siren as label, true as public, '5710' as legal_category,
                    true as active
                from (select buyer_siren as siren from contract_rows
                    union select holder_siren from contract_rows);
                create macro holder_label(siren, label) as label;
                create macro org_kind(category) as 'Société';
                create table grant_rows as select 'holder' as siren, 2025 as year,
                    code as programme_code, 100.0 as amount, code as purpose
                from (values ('2'), ('1')) t(code);
                create table plrg_programmes as
                select programme_code, programme_code as programme from grant_rows;
                create table procurement_recent_uids (uid varchar);
                create table boamp_input (buyer_id varchar);
                create table approch_input (siren_de_l_entite_acheteuse varchar);
                create table sanction_matches (siren varchar);
            """)
            contract_ids = []
            for reverse in (False, True):
                with self.subTest(reverse=reverse):
                    if reverse:
                        con.execute("""
                            insert into contract_rows select * replace (
                                'a00' as uid, 'new-buyer' as buyer_siren,
                                'new-holder' as holder_siren
                            ) from contract_rows where uid = 'c11';
                            insert into contract_amounts
                            select * replace ('a00' as uid) from contract_amounts
                            where uid = 'c11';
                            insert into identities select i.* replace (s as siren, s as label)
                            from identities i, (values ('new-buyer'), ('new-holder')) t(s)
                            where siren = 'holder';
                        """)
                        con.execute(
                            "create or replace table contract_rows as "
                            "select * from contract_rows order by uid desc, subject desc"
                        )
                        con.execute(
                            "create or replace table grant_rows as "
                            "select * from grant_rows order by programme_code"
                        )
                    con.execute((SQL / "40_orgs.sql").read_text())
                    self.assertEqual(
                        con.execute(
                            "select uid from org_contract_uids where siren='holder' order by uid"
                        ).fetchall(),
                        [(f"c{i:02}",) for i in range(9)],
                    )
                    self.assertEqual(
                        con.execute(
                            "select counterpart_siren from org_counterparts "
                            "where siren='holder' order by rank"
                        ).fetchall(),
                        [(f"b{i:02}",) for i in range(1, 9)],
                    )
                    self.assertEqual(
                        con.execute("select activity from orgs where siren='holder'").fetchone(),
                        ("A",),
                    )
                    self.assertEqual(
                        con.execute("select programme_code from grants order by id").fetchall(),
                        [("1",), ("2",)],
                    )
                    self.assertEqual(
                        con.execute(
                            "select subject, url from contracts c join source_files f "
                            "on f.id=c.source_file_id where uid='c00'"
                        ).fetchone(),
                        ("A", "source-a"),
                    )
                    contract_ids.append(
                        con.execute("select id from contracts where uid='c00'").fetchone()
                    )
            self.assertEqual(contract_ids[0], contract_ids[1])
