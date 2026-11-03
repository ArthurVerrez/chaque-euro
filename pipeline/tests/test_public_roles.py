import csv
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

import duckdb

from chaque_euro import public_roles as d
from chaque_euro.fetch import FetchRecord

SQL = Path(__file__).resolve().parents[1] / "sql"


def record(path: Path) -> FetchRecord:
    return FetchRecord("fixture", str(path), [], "2026-11-02T00:00:00Z", None, 0, "")


class DemocracyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.con = duckdb.connect()

    def tearDown(self) -> None:
        self.con.close()
        self.directory.cleanup()

    def test_nullable_money_dates_and_scalar_xml(self) -> None:
        self.assertEqual(d.many(None), [])
        self.assertEqual(d.many({"a": 1}), [{"a": 1}])
        self.assertEqual(d.text({"#text": "PA1"}), "PA1")
        self.assertEqual(d.text({"@xsi:nil": "true"}), "")
        self.assertEqual(d.cents("1 234,56"), 123456)
        self.assertEqual(d.cents("81863.199999999997"), 8186320)
        self.assertEqual(d.cents("0"), 0)
        self.assertIsNone(d.cents(""))
        self.assertIsNone(d.cents("-"))
        self.assertEqual(d.iso("29/11/2024 18:54:22"), "2024-11-29")

    def test_senate_encoding_preamble_and_multiline_csv(self) -> None:
        path = self.root / "senate.csv"
        path.write_bytes('% Query\r\nMatricule,Nom\r\n21077M,"Élu\r\npublic"\r\n'.encode("cp1252"))
        self.assertEqual(
            list(d.csv_rows(path, "cp1252", ",", "senate")),
            [{"Matricule": "21077M", "Nom": "Élu\r\npublic"}],
        )

    def test_actor_allowlist_drops_private_containers(self) -> None:
        actor = {
            "uid": {"#text": "PA1"},
            "etatCivil": {
                "ident": {"prenom": "Public", "nom": "Élu"},
                "infoNaissance": "PRIVATE_BIRTH",
            },
            "profession": "PRIVATE_PROFESSION",
            "adresses": "PRIVATE_CONTACT",
            "uri_hatvp": {"@xsi:nil": "true"},
            "mandats": {
                "mandat": {
                    "uid": "PM1",
                    "typeOrgane": "ASSEMBLEE",
                    "legislature": "17",
                    "dateDebut": "2024-07-08",
                    "dateFin": None,
                    "organes": {"organeRef": "PO1"},
                    "collaborateurs": "PRIVATE_ASSISTANT",
                }
            },
        }
        path = self.root / "members.zip"
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("json/acteur/PA1.json", json.dumps({"acteur": actor}))
        d._an(self.con, {"an-members": record(path), "an-history": record(path)})
        for table in ("people_raw", "mandates_raw", "organs_raw"):
            self.assertNotIn("PRIVATE", str(self.con.execute(f"select * from {table}").fetchall()))

    def test_hatvp_types_fields_mismatches_and_withdrawal(self) -> None:
        d.table(
            self.con,
            "people_raw",
            d.SCHEMAS["public_people"],
            [
                (
                    "PA1",
                    "Public",
                    "Élu",
                    "Public Élu",
                    None,
                    "AN",
                    None,
                    None,
                    None,
                    1,
                    None,
                    "an-members",
                )
            ],
        )
        d.table(self.con, "senate_people", d.SCHEMAS["public_people"], [])
        self.con.execute("set variable democracy_as_of='2026-11-02'")
        d.table(self.con, "mandates_raw", d.SCHEMAS["public_mandates"], [])
        d.table(self.con, "organs_raw", d.SCHEMAS["public_organs"], [])
        columns = [
            "type_document",
            "statut_publication",
            "date_publication",
            "open_data",
            "type_mandat",
            "id_origine",
            "prenom",
            "nom",
            "date_depot",
        ]

        def inventory(rows: list[list[str]]) -> None:
            with (self.root / "inventory.csv").open("w") as out:
                writer = csv.writer(out, delimiter=";")
                writer.writerow(columns)
                writer.writerows(rows)

        rows, xml = [], []
        kinds = ["di", "dim", "dia", "diam", "dsp", "dspm", "dspfm", "future", "di"]
        for i, kind in enumerate(kinds, 1):
            day = f"2024-08-{i:02d}"
            rows.append(
                [kind, "Livrée", day, f"public-{i}.xml", "depute", "1", "Public", "Élu", day]
            )
            xml_kind = (
                "DSP"
                if i == 9
                else "DIA"
                if kind.startswith("dia")
                else "DI"
                if kind in {"di", "dim"}
                else kind.upper()
            )
            xml.append(
                f"<declaration><dateDepot>{i:02d}/08/2024 12:00:00</dateDepot>"
                f"<general><typeDeclaration><id>{xml_kind}</id></typeDeclaration>"
                "<declarant><prenom>Public</prenom><nom>Élu</nom>"
                "<dateNaissance>PRIVATE_BIRTH</dateNaissance>"
                "<adresseDec>PRIVATE_ADDRESS</adresseDec></declarant>"
                "<qualiteMandat><codTypeMandatFichier>depute</codTypeMandatFichier>"
                "</qualiteMandat></general><activProfCinqDerniereDto><items><items>"
                "<description>PRIVATE_TEXT</description><employeur>PRIVATE_EI</employeur>"
                "</items></items><neant>false</neant></activProfCinqDerniereDto>"
                "<activProfConjointDto>PRIVATE_SPOUSE</activProfConjointDto>"
                "<activCollaborateursDto>PRIVATE_ASSISTANT</activCollaborateursDto>"
                "<attachedFiles>PRIVATE_ATTACHMENT</attachedFiles></declaration>"
            )
        inventory(rows)
        (self.root / "declarations.xml").write_text(
            "<declarations>" + "".join(xml) + "</declarations>"
        )
        d._interests(self.con, {"hatvp-interests": record(self.root)})
        self.assertEqual(
            self.con.execute("select type from interests_raw order by type").fetchall(),
            [("DI",), ("DIA",), ("DIAM",), ("DIM",)],
        )
        for table in ("interests_raw", "interest_sections_raw"):
            output = str(self.con.execute(f"select * from {table}").fetchall())
            self.assertNotIn("PRIVATE", output)
            self.assertNotIn("DSP", output)
        inventory([])
        d._interests(self.con, {"hatvp-interests": record(self.root)})
        for table in ("interests_raw", "interest_sections_raw"):
            self.assertEqual(self.con.execute(f"select count(*) from {table}").fetchone(), (0,))

    def test_copy_data_is_not_executed_and_escapes_survive(self) -> None:
        path = self.root / "dosleg.zip"
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr(
                "dosleg.sql",
                "DROP TABLE important;\n"
                "COPY votsen (senmat, note, missing) FROM stdin;\n"
                "21077M\tligne\\navec\\ttexte\\\\fin\t\\N\n\\.\n",
            )
        self.assertEqual(
            list(d.copy_rows(str(path), {"votsen"})),
            [("votsen", {"senmat": "21077M", "note": "ligne\navec\ttexte\\fin", "missing": None})],
        )

    def test_european_continuation_and_rectification_rows(self) -> None:
        path = self.root / "leg.csv"
        path.write_text("candidat;nom;scrutin;decision\n")
        rows = [{}] * 6 + [
            {"A": "PUBLIC Candidat", "B": "100", "C": "100"},
            {"B": "90", "C": "90", "R": "AR"},
            {"B": "95", "C": "95", "R": "A"},
            {"A": "AUTRE Candidat", "B": "0", "C": "0", "R": "AD"},
        ]
        with patch.object(d, "xlsx_rows", return_value=iter(rows)):
            d._campaigns(self.con, {"cnccfp-leg2024": record(path), "cnccfp-eu2024": record(path)})
        self.assertEqual(
            self.con.execute(
                "select "
                "candidate_name,declared_expenses_cents,retained_expenses_cents,decision_code"
                " from campaign_accounts_raw order by candidate_name"
            ).fetchall(),
            [("AUTRE Candidat", 0, 0, "AD"), ("PUBLIC Candidat", 10000, 9500, "A")],
        )
        self.assertEqual(d.DECISIONS["DD"], "Dispensé de dépôt")
        self.assertNotIn("réformation", d.DECISIONS["ARR"])

    def test_senate_participation_uses_each_ballot_roster(self) -> None:
        self.con.execute("set variable democracy_as_of='2026-11-02'")
        d.table(self.con, "public_mandates", d.SCHEMAS["public_mandates"], [])
        d.table(self.con, "ballots_raw", d.SCHEMAS["public_ballots"], [])
        d.table(
            self.con,
            "senate_ballots",
            d.SCHEMAS["public_ballots"],
            [
                (str(i), "SENAT", i, "2026", "2026-02-01", "Vote", *([None] * 7), "senat-votes")
                for i in range(3)
            ],
        )
        d.table(self.con, "votes_raw", d.SCHEMAS["public_votes"], [])
        d.table(
            self.con,
            "senate_votes",
            d.SCHEMAS["public_votes"],
            [
                ("0", "SEN1", "pour", None, 0, None, "senat-votes"),
                ("1", "SEN1", "non-votant", None, 0, None, "senat-votes"),
                ("2", "SEN2", "abstention", None, 0, None, "senat-votes"),
            ],
        )
        for name in ("corrections_raw", "senate_corrections"):
            d.table(self.con, name, d.SCHEMAS["public_vote_corrections"], [])
        self.con.execute((SQL / "47_public_votes.sql").read_text())
        self.assertEqual(
            self.con.execute(
                "select person_id,numerator,denominator from public_person_metrics "
                "where window_kind='legislature' order by person_id"
            ).fetchall(),
            [("SEN1", 1, 2), ("SEN2", 1, 1)],
        )

    def test_participation_excludes_gap_non_voter_and_missing_entry(self) -> None:
        self.con.execute("set variable democracy_as_of='2026-11-02'")
        d.table(
            self.con,
            "public_mandates",
            d.SCHEMAS["public_mandates"],
            [
                (
                    "M1",
                    "PA1",
                    "ASSEMBLEE",
                    "AN",
                    None,
                    None,
                    None,
                    None,
                    "2024-07-08",
                    "2025-01-01",
                    "day",
                    "an-members",
                ),
                (
                    "M2",
                    "PA1",
                    "ASSEMBLEE",
                    "AN",
                    None,
                    None,
                    None,
                    None,
                    "2026-01-01",
                    None,
                    "day",
                    "an-members",
                ),
            ],
        )
        ballots = [
            (
                str(i),
                "AN",
                i,
                "17",
                day,
                "Vote",
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                "an-votes",
            )
            for i, day in enumerate(["2024-10-01", "2025-06-01", "2026-02-01", "2026-03-01"])
        ]
        d.table(self.con, "ballots_raw", d.SCHEMAS["public_ballots"], ballots)
        d.table(self.con, "senate_ballots", d.SCHEMAS["public_ballots"], [])
        d.table(
            self.con,
            "votes_raw",
            d.SCHEMAS["public_votes"],
            [
                ("0", "PA1", "pour", None, 1, None, "an-votes"),
                ("1", "PA1", "pour", None, 0, None, "an-votes"),
                ("2", "PA1", "non-votant", None, 0, None, "an-votes"),
            ],
        )
        d.table(self.con, "senate_votes", d.SCHEMAS["public_votes"], [])
        for name in ("corrections_raw", "senate_corrections"):
            d.table(self.con, name, d.SCHEMAS["public_vote_corrections"], [])
        self.con.execute((SQL / "47_public_votes.sql").read_text())
        self.assertEqual(
            self.con.execute(
                "select numerator,denominator from public_person_metrics where "
                "window_kind='legislature'"
            ).fetchone(),
            (1, 3),
        )
        self.assertEqual(
            self.con.execute(
                "select numerator,denominator from public_person_metrics where "
                "window_kind='12-months'"
            ).fetchone(),
            (0, 2),
        )

    def test_cada_private_narratives_and_sanctions_never_exported(self) -> None:
        path = self.root / "cada.csv"
        with path.open("w") as out:
            writer = csv.writer(out)
            writer.writerow(
                [
                    "Numéro de dossier",
                    "Type",
                    "Séance",
                    "Sens et motivation",
                    "Avis",
                    "Administration",
                ]
            )
            writer.writerows(
                [
                    [
                        "1",
                        "Avis",
                        "18/04/2024",
                        "Favorable, Défavorable",
                        "PRIVATE_REQUESTER",
                        "PRIVATE_ADMIN",
                    ],
                    ["2", "Sanction", "18/04/2024", "", "PRIVATE_NAME", ""],
                ]
            )
        d._cada(self.con, {"cada": record(path)})
        rows = self.con.execute("select * from cada_raw").fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][3:5], (1, 1))
        self.assertNotIn("PRIVATE", str(rows))

    def test_rne_person_fields_are_dropped_before_aggregation(self) -> None:
        from types import SimpleNamespace

        path = self.root / "mai.csv"
        with path.open("w") as out:
            writer = csv.writer(out, delimiter=";")
            writer.writerow(
                [
                    "Code du département",
                    "Libellé du département",
                    "Code de la commune",
                    "Libellé de la commune",
                    "Nom de l'élu",
                    "Prénom de l'élu",
                    "Code sexe",
                    "Date de naissance",
                    "Date de début du mandat",
                    "Date de début de la fonction",
                    "Profession",
                ]
            )
            writer.writerow(
                [
                    "01",
                    "Ain",
                    "01001",
                    "Commune",
                    "Public",
                    "Élu",
                    "F",
                    "1980-01-01",
                    "2026-03-15",
                    "2026-03-23",
                    "PRIVATE_PROFESSION",
                ]
            )
        source = SimpleNamespace(id="rne", files={"mai.csv": "snapshot/20260811-000000/mai.csv"})
        with patch.object(d, "load_registry", return_value=[source]):
            d._rne(self.con, {"rne": record(self.root)})
        for table in ("rne_statistics_raw", "local_executives_raw"):
            output = str(self.con.execute(f"select * from {table}").fetchall())
            self.assertNotIn("1980-01-01", output)
            self.assertNotIn("PRIVATE", output)
        self.assertEqual(
            self.con.execute("select sex,age_band,records from rne_statistics_raw").fetchone(),
            ("Femmes", "45 à 59 ans", 1),
        )

    def test_minister_page_requires_matching_official_name_and_office(self) -> None:
        self.con.execute("set variable democracy_as_of='2026-11-02'")
        d.table(
            self.con,
            "people_raw",
            d.SCHEMAS["public_people"],
            [
                (
                    "PA1",
                    "Public",
                    "Élu",
                    "Public Élu",
                    None,
                    "AN",
                    None,
                    None,
                    None,
                    1,
                    None,
                    "an-history",
                )
            ],
        )
        d.table(self.con, "senate_people", d.SCHEMAS["public_people"], [])
        d.table(
            self.con,
            "mandates_raw",
            d.SCHEMAS["public_mandates"],
            [
                (
                    "PM1",
                    "PA1",
                    "MINISTERE",
                    "AN",
                    "PO1",
                    None,
                    None,
                    "Ministre",
                    "2026-01-01",
                    None,
                    "day",
                    "an-history",
                )
            ],
        )
        d.table(
            self.con,
            "organs_raw",
            d.SCHEMAS["public_organs"],
            [("AN", "PO1", "MINISTERE", "Ministère des essais", None, None, None, "an-history")],
        )
        columns = [
            "type_document",
            "statut_publication",
            "date_publication",
            "open_data",
            "type_mandat",
            "prenom",
            "nom",
            "qualite",
            "url_dossier",
        ]

        def inventory(office: str) -> None:
            with (self.root / "inventory.csv").open("w") as out:
                writer = csv.writer(out, delimiter=";")
                writer.writerow(columns)
                writer.writerow(
                    [
                        "di",
                        "Livrée",
                        "2026-02-01",
                        "",
                        "gouvernement",
                        "Public",
                        "Élu",
                        office,
                        "/pages_nominatives/public-elu",
                    ]
                )

        (self.root / "declarations.xml").write_text("<declarations/>")
        inventory("Ministre de la culture")
        d._interests(self.con, {"hatvp-interests": record(self.root)})
        self.assertIsNone(self.con.execute("select hatvp_ref from people_raw").fetchone()[0])
        inventory("Ministre des essais")
        d._interests(self.con, {"hatvp-interests": record(self.root)})
        self.assertEqual(
            self.con.execute("select hatvp_ref from people_raw").fetchone(), ("public-elu",)
        )
        self.assertEqual(self.con.execute("select count(*) from interests_raw").fetchone(), (0,))
