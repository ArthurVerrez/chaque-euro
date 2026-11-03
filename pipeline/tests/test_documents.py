import io
import json
import tarfile
import tempfile
import unittest
import zipfile
from datetime import date
from pathlib import Path

import duckdb

from chaque_euro.documents import (
    TABLES,
    administrative_rows,
    an_files,
    appointment,
    copy_rows,
    dole_files,
    journals,
    protected,
)
from chaque_euro.registry import load_registry


class OfficialDocumentsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name)
        self.sources = {source.id: source for source in load_registry()}

    def archive(self, filename: str, values: list[str]) -> None:
        with tarfile.open(self.path / filename, "w:gz") as archive:
            for index, value in enumerate(values):
                content = value.encode()
                member = tarfile.TarInfo(f"{index}.xml")
                member.size = len(content)
                archive.addfile(member, io.BytesIO(content))

    def test_protected_categories_and_appointment_boundary(self) -> None:
        for title in (
            "Accès protégé",
            "Décret de naturalisation",
            "Demandes de changement de nom",
            "Réintégration dans la nationalité française",
            "Déchéance de nationalité",
            "Suspension de la Légion d\u2019honneur",
            "Annonce de sanction disciplinaire",
        ):
            self.assertTrue(protected(title), title)
        self.assertFalse(protected("Avis de recrutement, protection de l'environnement"))
        self.assertEqual(appointment("Arrêté portant nomination au conseil"), "nomination")
        self.assertEqual(appointment("Avis relatif aux modalités de nomination"), "autre")
        self.assertEqual(appointment("Arrêté portant désignation au conseil"), "désignation")
        self.assertEqual(appointment("Décret portant cessation de fonctions"), "cessation")

    def test_replay_reconciles_summaries_and_does_not_count_corrections(self) -> None:
        summary = """<JO><ID>JO1</ID><DATE_PUBLI>2026-11-01</DATE_PUBLI><NUM>0256</NUM>
        <STRUCTURE_TXT><TM><TITRE_TM>Ministère de la culture</TITRE_TM>
        <LIEN_TXT idtxt="T1" titretxt="Arrêté portant nomination"/>
        <LIEN_TXT idtxt="T2" titretxt="Demandes de changement de nom"/>
        <LIEN_TXT idtxt="T3" titretxt="Avis"/></TM></STRUCTURE_TXT></JO>"""
        initial = """<TEXTE><ID>T1</ID><DATE_PUBLI>2026-11-01</DATE_PUBLI>
        <NATURE>ARRETE</NATURE><TITREFULL>Arrêté portant nomination de Mme Exemple</TITREFULL>
        <ORIGINE_PUBLI id="JO1"/></TEXTE>"""
        protected_text = """<TEXTE><ID>T2</ID><DATE_PUBLI>2026-11-01</DATE_PUBLI>
        <TITREFULL>Demandes de changement de nom : NePasPublier</TITREFULL></TEXTE>"""
        old = initial.replace("T1", "OLD").replace("2026-11-01", "1958-01-01")
        self.archive("JORFSIMPLE_20261101-000000.tar.gz", [summary, initial, protected_text])
        self.archive(
            "JORFSIMPLE_20261101-210000.tar.gz", [initial.replace("Exemple", "Corrigée"), old]
        )
        first = journals(str(self.path), self.sources["jorfsimple"], date(2026, 11, 2))
        second = journals(str(self.path), self.sources["jorfsimple"], date(2026, 11, 2))
        self.assertEqual(first, second)
        self.assertEqual(len(first["official_texts"]), 1)
        self.assertIn("Corrigée", first["official_texts"][0][4])
        self.assertEqual(first["official_texts"][0][6], "Ministère de la culture")
        self.assertNotIn("NePasPublier", str(first))
        self.assertEqual(first["official_journals"][0][3:6], (3, 1, 1))
        self.archive("JORFSIMPLE_20261102-000000.tar.gz", [initial.replace("ARRETE", "DECISION")])
        revised = journals(str(self.path), self.sources["jorfsimple"], date(2026, 11, 2))
        self.assertNotIn("Exemple", revised["official_texts"][0][4])

    def test_private_names_are_removed_before_public_rows(self) -> None:
        labels = ["M. Exemple", "MM. Exemple et Autre", "Mmes Exemple et Autre", "Mlle Exemple"]
        refs = "".join(f'<LIEN_TXT idtxt="T{i}" titretxt="Avis"/>' for i in range(len(labels)))
        summary = (
            "<JO><ID>JO1</ID><DATE_PUBLI>2026-11-01</DATE_PUBLI>"
            f"<STRUCTURE_TXT>{refs}</STRUCTURE_TXT></JO>"
        )
        texts = [
            f"<TEXTE><ID>T{i}</ID><DATE_PUBLI>2026-11-01</DATE_PUBLI>"
            f"<NATURE>AVIS</NATURE><TITREFULL>Avis concernant {label}</TITREFULL></TEXTE>"
            for i, label in enumerate(labels)
        ]
        self.archive("JORFSIMPLE_20261101-000000.tar.gz", [summary, *texts])
        result = journals(str(self.path), self.sources["jorfsimple"], date(2026, 11, 2))
        self.assertEqual(len(result["official_texts"]), len(labels))
        self.assertNotIn("Exemple", str(result))
        self.assertNotIn("Autre", str(result))

    def test_dole_stock_is_applied_before_increments(self) -> None:
        stock = (
            "<DOSSIER_LEGISLATIF><META><META_COMMUN><ID>D1</ID></META_COMMUN>"
            "<META_DOSSIER_LEGISLATIF><TITRE>Ancien</TITRE><TYPE>LOI_PUBLIEE</TYPE>"
            "</META_DOSSIER_LEGISLATIF></META></DOSSIER_LEGISLATIF>"
        )
        self.archive("Freemium_dole_global_20250713-140000.tar.gz", [stock])
        self.archive("DOLE_20261030-214909.tar.gz", [stock.replace("Ancien", "Corrigé")])
        result = dole_files(str(self.path), self.sources["dole"], date(2026, 11, 2))
        self.assertEqual(result["legislative_files"][0][1], "Corrigé")

    def test_an_preserves_future_and_undated_events(self) -> None:
        path = self.path / "an.zip"
        dossier = {
            "@xsi:type": "DossierLegislatif_Type",
            "uid": "DLR1",
            "legislature": "17",
            "titreDossier": {
                "titre": "Projet de loi de finances pour 2027",
                "titreChemin": "PLF_2027",
            },
            "procedureParlementaire": {"code": "3", "libelle": "PLF"},
            "actesLegislatifs": {
                "acteLegislatif": [
                    {"uid": "FUTUR", "codeActe": "AN1", "dateActe": "2026-11-17"},
                    {"uid": "INCONNU", "codeActe": "AN1", "dateActe": None},
                    {"uid": "PASSE", "codeActe": "AN1", "dateActe": "2026-10-01"},
                ]
            },
        }
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr(
                "json/dossierParlementaire/1.json", json.dumps({"dossierParlementaire": dossier})
            )
            archive.writestr(
                "json/dossierParlementaire/rapport.json",
                json.dumps({"dossierParlementaire": {"@xsi:type": "DossierMissionControle_Type"}}),
            )
        result = an_files(str(path), self.sources["an-dossiers"], date(2026, 11, 2))
        self.assertEqual(len(result["legislative_files"]), 1)
        self.assertEqual(
            [row[6] for row in result["legislative_events"]], ["annoncé", "indéterminé", "réalisé"]
        )
        self.assertEqual(result["budget_legislation"][0][1:3], (2027, "PLF"))

    def test_financial_laws_keep_results_and_fin_de_gestion_distinct(self) -> None:
        with duckdb.connect() as con:
            for table in (
                "legislative_files",
                "legislative_file_refs",
                "legislative_events",
                "legislative_documents",
                "budget_legislation",
            ):
                con.execute(f"create table {table}_raw ({TABLES[table]})")
            con.execute(
                "insert into legislative_files_raw values "
                "('R','Projet de loi relatif aux résultats de la gestion 2025',"
                "'Projet de loi ordinaire','17','Non renseigné','an-dossiers',null,''),"
                "('F','Projet de loi de finances de fin de gestion pour 2025',"
                "'Projet de loi de finances rectificative','17','Non renseigné',"
                "'an-dossiers',null,'')"
            )
            con.execute(
                "insert into budget_legislation_raw values "
                "('F',2025,'Loi de finances rectificative','État','Procédure')"
            )
            script = Path(__file__).parents[1] / "sql" / "66_legislative_files.sql"
            con.execute(script.read_text())
            self.assertEqual(
                con.execute(
                    "select file_id,law_kind from budget_legislation order by file_id"
                ).fetchall(),
                [("F", "Loi de finances de fin de gestion"), ("R", "Loi de résultats")],
            )

    def test_senate_copy_is_parsed_without_execution(self) -> None:
        path = self.path / "senate.zip"
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr(
                "dosleg.sql",
                "DROP TABLE forbidden;\nCOPY loi (id, title, empty) FROM stdin;\n"
                "1  \tTexte\\tavec\\nretour\\\\fin\t\\N\n\\.\n",
            )
        rows = copy_rows(str(path), {"loi"})["loi"]
        self.assertEqual(rows, [{"id": "1", "title": "Texte\tavec\nretour\\fin", "empty": None}])

    def test_directory_excludes_people_and_non_diffusible_services(self) -> None:
        path = self.path / "services.json"
        path.write_text(
            json.dumps(
                [
                    {
                        "id": "A",
                        "nom": "Préfecture",
                        "statut_de_diffusion": "true",
                        "siren": "123456789",
                        "hierarchie": json.dumps(
                            [{"type_hierarchie": "Service Fils", "service": "B"}]
                        ),
                        "affectation_personne": [{"nom": "NePasPublier"}],
                        "adresse_courriel": ["secret"],
                    },
                    {"id": "B", "nom": "Non diffusé", "statut_de_diffusion": "false"},
                ]
            )
        )
        result = administrative_rows(str(path), self.sources["annuaire-etat"])
        self.assertEqual(len(result["administrations"]), 1)
        self.assertNotIn("NePasPublier", str(result))
        self.assertNotIn("secret", str(result))
        self.assertEqual(
            result["administration_relations"], [("A", "B", "Service Fils", "annuaire-etat")]
        )
