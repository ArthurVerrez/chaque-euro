import sqlite3
import unittest
from pathlib import Path

import duckdb

PIPELINE = Path(__file__).resolve().parents[1]


class SearchTests(unittest.TestCase):
    def test_entities_and_public_officials_share_accent_insensitive_index(self) -> None:
        with duckdb.connect() as con:
            con.execute("""
                create table orgs as select * from (values
                    ('Croix-Rouge française', 'Association', '775672272', null, 0, 0, 100),
                    ('ELECTRICITE DE FRANCE', 'Société commerciale', '552081317', null,
                        900, 0, 0)) t(name, kind, siren, activity,
                    won_amount, awarded_amount, grants_amount);
                create table identities as select * from (values
                    ('775672272', 'CRF'), ('552081317', 'EDF')) t(siren, acronym);
                create table communes as select * from (values
                    ('Lyon', '69123', 'Rhône', '69', 500000),
                    ('Œuilly', '02566', 'Aisne', '02', 300)) t(name, insee,
                    department_name, department_code, population);
                create table public_people as select 'PA1' as id,
                    'Élodie Députée' as display_name, 'deputy' as role_kind,
                    'Rhône' as territory_label, null as group_label, 1 as active;
                create table administrations (id varchar, head_name varchar,
                    head_role varchar, name_public varchar);
                insert into administrations values
                    ('presidence','Emmanuel MACRON','Président de la République','Présidence'),
                    ('matignon','Sébastien LECORNU','Premier ministre','Premier ministre'),
                    ('justice','Gérald DARMANIN','Ministre','Ministère de la Justice'),
                    ('culture','Catherine PÉGARD','Ministre','Ministère de la Culture'),
                    ('service',null,null,'Service');
            """)
            con.execute((PIPELINE / "sql/80_search.sql").read_text())
            rows = con.execute("select * from search").fetchall()
        with sqlite3.connect(":memory:") as db:
            db.executescript((PIPELINE / "schema.sql").read_text())
            db.executemany("insert into search values (?,?,?,?,?,?)", rows)
            for query, expected in [
                ('"croix"* "rouge"*', ("Association", "775672272")),
                ('"LYON"*', ("Commune", "69123")),
                ('"elodie"* "deputee"*', ("Élu", "PA1")),
                ('"ÉLODIE"*', ("Élu", "PA1")),
                ('"macron"*', ("Responsable public", "presidence")),
                ('"sebastien"* "lecornu"*', ("Responsable public", "matignon")),
                ('"darmanin"*', ("Responsable public", "justice")),
                ('"pegard"*', ("Responsable public", "culture")),
                ('"edf"*', ("Société commerciale", "552081317")),
                ('"oeuilly"*', ("Commune", "02566")),
                ('"œuilly"*', ("Commune", "02566")),
            ]:
                with self.subTest(query=query):
                    self.assertEqual(
                        db.execute(
                            "select kind,ref from search where search match ?", [query]
                        ).fetchone(),
                        expected,
                    )
            self.assertEqual(
                db.execute("select detail from search where kind='Élu'").fetchone(),
                ("Député ou députée · Rhône",),
            )
            self.assertEqual(
                db.execute("select name from search where ref='02566'").fetchone(), ("Œuilly",)
            )
