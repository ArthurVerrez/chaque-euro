import csv
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

import duckdb

from chaque_euro.fetch import FetchRecord
from chaque_euro.gleif import load

SQL = Path(__file__).resolve().parents[1] / "sql"


class GleifInputTests(unittest.TestCase):
    def test_exact_authority_category_and_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fields = [
                "LEI",
                "Entity.RegistrationAuthority.RegistrationAuthorityID",
                "Entity.RegistrationAuthority.RegistrationAuthorityEntityID",
                "Entity.EntityCategory",
                "Entity.EntityStatus",
                "Registration.RegistrationStatus",
            ]
            entity = root / "entities.csv"
            with entity.open("w") as handle:
                writer = csv.writer(handle)
                writer.writerow(fields)
                writer.writerows(
                    [lei, authority, siren, category, "ACTIVE", "ISSUED"]
                    for lei, authority, siren, category in (
                        ("A", "RA000189", "012345678", "GENERAL"),
                        ("B", "RA000250", "123456789", "GENERAL"),
                        ("C", "RA000189", "12345678900001", "GENERAL"),
                        ("D", "RA000189", "12345 6789", "GENERAL"),
                        ("E", "RA000189", "123456789", "SOLE_PROPRIETOR"),
                        ("F", "RA000192", "123 456 789", "GENERAL"),
                        ("G", "RA000192", "NANTERRE123456789", "GENERAL"),
                    )
                )
            relationship = root / "relationships.csv"
            with relationship.open("w") as handle:
                writer = csv.writer(handle)
                writer.writerow(
                    [
                        "Relationship.StartNode.NodeID",
                        "Relationship.StartNode.NodeIDType",
                        "Relationship.EndNode.NodeID",
                        "Relationship.EndNode.NodeIDType",
                        "Relationship.RelationshipType",
                        "Relationship.RelationshipStatus",
                        "Registration.RegistrationStatus",
                        "Registration.LastUpdateDate",
                        *[
                            f"Relationship.Period.{n}.{field}"
                            for n in range(1, 6)
                            for field in ("periodType", "startDate", "endDate")
                        ],
                    ]
                )
                for kind in ("IS_ULTIMATELY_CONSOLIDATED_BY", "IS_DIRECTLY_CONSOLIDATED_BY"):
                    writer.writerow(
                        ["A", "LEI", "B", "LEI", kind, "ACTIVE", "PUBLISHED", "2026-10-01"]
                        + [""] * 15
                    )
            records = {}
            for source_id, file, cdf in (
                ("gleif-entities", entity, "lei2"),
                ("gleif-relationships", relationship, "rr"),
            ):
                archive = root / f"{cdf}.zip"
                with zipfile.ZipFile(archive, "w") as output:
                    output.write(file, f"20261104-0800-gleif-goldencopy-{cdf}-golden-copy.csv")
                records[source_id] = FetchRecord(source_id, str(archive), [], "", None, 0, "")
            records["gleif-registration-authorities"] = records["gleif-entities"]
            con = duckdb.connect()
            with patch(
                "chaque_euro.gleif.pdf_text",
                return_value=(
                    "RA000189 France FR France Register of Companies (Sirene)\n"
                    "RA000192 France FR France Register of Commerce and Companies"
                ),
            ):
                load(con, records)
                self.assertEqual(
                    con.execute("select lei, siren from gleif_entity_input").fetchall(),
                    [("A", "012345678"), ("F", "123456789")],
                )
                self.assertEqual(
                    con.execute("select count(*) from gleif_relationship_input").fetchone(), (1,)
                )
                with zipfile.ZipFile(root / "rr.zip", "w") as output:
                    output.write(relationship, "20261103-0800-gleif-goldencopy-rr-golden-copy.csv")
                with self.assertRaisesRegex(ValueError, "snapshots differ"):
                    load(con, records)
            with (
                patch("chaque_euro.gleif.pdf_text", return_value="RA000250 Other registry"),
                self.assertRaisesRegex(ValueError, "authority not confirmed"),
            ):
                load(con, records)


class GleifGroupTests(unittest.TestCase):
    def test_documented_unique_public_groups_and_shared_contract(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            con = duckdb.connect()
            con.execute("""
                set variable gleif_as_of = date '2026-11-04';
                create table sample as
                select (100000000 + n)::varchar as siren,
                    'SOCIETE ' || n as denominationUniteLegale,
                    case when n = 4 then '1000' else '5599' end as categorieJuridiqueUniteLegale,
                    case when n = 5 then 'C' else 'A' end as etatAdministratifUniteLegale,
                    case when n = 3 then 'P' else 'O' end as statutDiffusionUniteLegale
                from range(16) t(n);
                create table gleif_entity_input as
                select 'LEI' || n as lei, (100000000 + n)::varchar as siren,
                    'ACTIVE' as entity_status, 'ISSUED' as registration_status
                from range(16) t(n);
                insert into gleif_entity_input
                    values ('DUPLICATE', '100000006', 'ACTIVE', 'ISSUED');
                create table orgs as select siren from sample where siren <> '100000015';
                create macro org_kind(category) as 'Société commerciale';
                create table org_groups (
                    siren varchar, name varchar, as_of varchar, analysis_path varchar,
                    amount_year integer
                );
                create table org_group_members (
                    group_siren varchar, siren varchar, name varchar, kind varchar,
                    legal_category varchar, active boolean, parent_siren varchar,
                    source_id varchar, source_ref varchar, identifier_source_id varchar,
                    identifier_ref varchar, parent_kind varchar
                );
                insert into org_group_members values (
                    'SNCF', '100000014', 'EXISTANT', '', '5599', true, null,
                    'sncf-groupe-2025', '', '', '', 'root'
                );
                create table gleif_relationship_input as
                select 'LEI' || n as child_lei, 'LEI0' as parent_lei,
                    'IS_ULTIMATELY_CONSOLIDATED_BY' as relationship_type,
                    case when n = 10 then 'INACTIVE' else 'ACTIVE' end as relationship_status,
                    case when n = 9 then 'LAPSED' else 'PUBLISHED' end as registration_status,
                    '2026-10-01' as updated_at,
                    [struct_pack(kind := 'RELATIONSHIP_PERIOD',
                        starts := case when n = 11 then '2027-01-01' else '2020-01-01' end,
                        ends := case when n = 12 then '2026-01-01' else null end)] as periods
                from range(1, 15) t(n);
                insert into gleif_relationship_input
                    select child_lei, parent_lei, relationship_type, relationship_status,
                        registration_status, '2026-10-02', periods
                    from gleif_relationship_input where child_lei = 'LEI1';
                insert into gleif_relationship_input
                    select child_lei, 'LEI15', relationship_type, relationship_status,
                        registration_status, updated_at, periods
                    from gleif_relationship_input where child_lei = 'LEI7';
                update gleif_entity_input set entity_status = 'INACTIVE' where lei = 'LEI8';
                update gleif_relationship_input set parent_lei = 'FOREIGN'
                    where child_lei = 'LEI13';
            """)
            sirene = str(Path(directory) / "sirene.parquet")
            con.execute("copy sample to ? (format parquet)", [sirene])
            con.execute("set variable sirene_path = ?", [sirene])
            con.execute((SQL / "40a_organisation_gleif_groups.sql").read_text())
            self.assertEqual(
                con.execute("select siren, amount_year from org_groups").fetchall(),
                [("100000000", 2025)],
            )
            self.assertEqual(
                con.execute("""
                    select siren, parent_kind from org_group_members
                    where group_siren <> 'SNCF' order by siren
                """).fetchall(),
                [("100000000", "root"), ("100000001", "ultimate"), ("100000002", "ultimate")],
            )
            self.assertEqual(
                con.execute("""
                    select source_ref from org_group_members where siren = '100000001'
                """).fetchone(),
                ("LEI LEI1, mère ultime LEI0, mise à jour 2026-10-02",),
            )
            con.execute("""
                create table holder_shares as
                select unnest(['100000001', '100000002']) as holder_siren,
                    true as holder_public, 2025 as year, 50.0 as share,
                    true as counted, false as amount_estimated;
                create table buyer_contracts (
                    buyer_siren varchar, year integer, amount double,
                    counted boolean, amount_estimated boolean
                );
                create table grants (siren varchar, year integer, amount double);
            """)
            con.execute((SQL / "40a_organisation_group_amounts.sql").read_text())
            self.assertEqual(
                con.execute("select sum(amount) from org_group_amounts").fetchone(), (100,)
            )
            con.execute("delete from org_group_members where group_siren <> 'SNCF'")
            con.execute("delete from org_groups")
            con.execute("""
                insert into gleif_relationship_input
                select 'LEI0', 'LEI15', relationship_type, relationship_status,
                    registration_status, updated_at, periods
                from gleif_relationship_input where child_lei = 'LEI2';
            """)
            con.execute((SQL / "40a_organisation_gleif_groups.sql").read_text())
            self.assertEqual(con.execute("select count(*) from org_groups").fetchone(), (0,))


if __name__ == "__main__":
    unittest.main()
