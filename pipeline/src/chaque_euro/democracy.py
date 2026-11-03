import csv
import io
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from collections.abc import Iterator
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import cast

import duckdb

from .fetch import FetchRecord


def _csv(
    con: duckdb.DuckDBPyConnection, name: str, content: str, columns: list[str], directory: Path
) -> None:
    rows = csv.reader(io.StringIO(content), delimiter=";")
    header = next(rows)
    positions = [header.index(column) for column in columns]
    with NamedTemporaryFile(mode="w+", suffix=".csv", dir=directory, newline="") as handle:
        writer = csv.writer(handle, delimiter=";")
        writer.writerow(columns)
        writer.writerows(tuple(row[i] for i in positions) for row in rows)
        handle.flush()
        con.execute(
            f"create table {name} as select * from read_csv(?, delim=';', "
            "header=true, all_varchar=true)",
            [handle.name],
        )


def load(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    con.execute("set variable lobbying_as_of = ?::date", [records["hatvp-agora"].retrieved_at[:10]])
    with zipfile.ZipFile(records["hatvp-agora"].path) as archive:
        for name, filename, columns in [
            (
                "agora_organisations",
                "1_informations_generales.csv",
                [
                    "representants_id",
                    "denomination",
                    "identifiant_national",
                    "type_identifiant_national",
                    "pays",
                    "label_categorie_organisation",
                    "dateCessation",
                ],
            ),
            (
                "agora_exercises",
                "15_exercices.csv",
                [
                    "exercices_id",
                    "representants_id",
                    "date_debut",
                    "date_fin",
                    "nombre_activites",
                    "date_publication",
                    "montant_depense",
                    "montant_depense_inf",
                    "montant_depense_sup",
                ],
            ),
            (
                "agora_activities",
                "8_objets_activites.csv",
                ["activite_id", "exercices_id", "date_publication_activite"],
            ),
            (
                "agora_targets",
                "13_ministeres_aai_api.csv",
                [
                    "action_representation_interet_id",
                    "responsable_public",
                    "departement_ministeriel",
                ],
            ),
        ]:
            _csv(
                con,
                name,
                archive.read(f"Vues_Separees/{filename}").decode("utf-8-sig"),
                columns,
                Path(records["hatvp-agora"].path).parent,
            )

    defaults = json.loads(Path(records["hatvp-defaults"].path).read_text())
    if len(defaults) != 4 or not isinstance(defaults[2], list):
        raise ValueError("HATVP official defaults list structure changed")
    con.execute("create table agora_defaults (identifier varchar, period varchar, missing varchar)")
    con.executemany(
        "insert into agora_defaults values (?, ?, ?)",
        [
            (r["identifiantNational"], r["exerciceBlackliste"], r["infosNonDeclarees"])
            for r in defaults[2]
        ],
    )
    _eu(con, Path(records["eu-transparency"].path))
    for year in range(2021, 2025):
        path = Path(records["cnccfp-parties"].path) / f"{year}.csv"
        _csv(
            con,
            f"party_raw_{year}",
            path.read_text(encoding="utf-8-sig"),
            [
                "Code_CNCCFP",
                "Nom_du_parti",
                "Unite_monetaire",
                "Exercice",
                "Cotisations_des_adherents",
                "Cotisations_des_elus",
                "Aide_publique_1ere_fraction",
                "Aide_publique_2nde_fraction",
                "Autres_aides_publiques",
                "Dons_de_personne_physique",
                "Total_des_produits_I_+_III_+_V",
            ],
            path.parent,
        )
        with path.open(encoding="utf-8-sig") as handle:
            rows = list(csv.reader(handle, delimiter=";"))
        header = rows[0]
        start = header.index("Cotisations_des_adherents")
        end = header.index("Contributions_versees_aux_candidats") - 1
        financial = max(i for i, name in enumerate(header) if name == "Total_III")
        exceptional = header.index("Total_V")
        component_positions = [*range(start, end), financial, exceptional]
        con.execute(f"create table party_components_{year} (code varchar, component varchar)")
        con.executemany(
            f"insert into party_components_{year} values (?, ?)",
            [(r[0], r[i]) for r in rows[1:] for i in component_positions],
        )

    status = Path(records["cnccfp-status"].path).read_text(encoding="utf-8")
    match = re.search(r"var data\s*=\s*(\[.*?\]);", status, re.S)
    if match is None or "var annee_decision = 2024;" not in status:
        raise ValueError("CNCCFP status structure or exercise changed")
    parties = json.loads(match[1])
    con.execute(
        "create table party_status_raw "
        "(code varchar, name varchar, decision varchar, reason varchar, aid_loss_until varchar)"
    )
    con.executemany(
        "insert into party_status_raw values (?, ?, ?, ?, ?)",
        [
            (
                r["parcode"],
                r["parnom"],
                r["decision_2024"],
                r["motif_2024"],
                r["date_fin_sanctions_ap"],
            )
            for r in parties
        ],
    )


def _xml11_events(path: Path) -> Iterator[ET.Element]:
    parser: ET.XMLPullParser[ET.Element] = ET.XMLPullParser(events=["end"])

    def character(match: re.Match[bytes]) -> bytes:
        reference = match[0][2:-1]
        number = int(reference[1:], 16) if reference.startswith(b"x") else int(reference)
        return b"" if number < 32 and number not in (9, 10, 13) else match[0]

    pending = b""
    with path.open("rb") as handle:
        while chunk := handle.read(1 << 20):
            content, separator, pending = (pending + chunk).rpartition(b"\n")
            if not separator:
                continue
            parser.feed(re.sub(rb"&#(?:x[0-9a-fA-F]+|[0-9]+);", character, content + b"\n"))
            for _, element in cast(Iterator[tuple[str, ET.Element]], parser.read_events()):
                yield element
        parser.feed(re.sub(rb"&#(?:x[0-9a-fA-F]+|[0-9]+);", character, pending))
        parser.close()
        for _, element in cast(Iterator[tuple[str, ET.Element]], parser.read_events()):
            yield element


def _eu(con: duckdb.DuckDBPyConnection, path: Path) -> None:
    con.execute(
        "create table eu_register_raw (id varchar, name varchar, country varchar, "
        "legal_form varchar, category varchar, start_date varchar, end_date varchar, "
        "cost_min varchar, cost_max varchar, cost_exact varchar, currency varchar)"
    )
    con.execute("create table eu_interests_raw (id varchar, area varchar)")
    rows: list[tuple[str, ...]] = []
    interests: list[tuple[str, str]] = []
    expected = seen = 0
    exported = ""
    for element in _xml11_events(path):
        if element.tag == "metaData":
            expected = int(element.findtext("numberOfIR", "0"))
            exported = element.findtext("exportDate", "")
        if element.tag != "interestRepresentative":
            continue
        seen += 1
        if element.findtext("headOffice/country") == "FRANCE":
            identifier = element.findtext("identificationCode", "")
            costs = element.find("financialData/closedYear/costs")
            rows.append(
                (
                    identifier,
                    element.findtext("name/originalName", ""),
                    "FRANCE",
                    element.findtext("entityForm", ""),
                    element.findtext("registrationCategory", ""),
                    element.findtext("financialData/closedYear/startDate", ""),
                    element.findtext("financialData/closedYear/endDate", ""),
                    element.findtext("financialData/closedYear/costs/range/min", ""),
                    element.findtext("financialData/closedYear/costs/range/max", ""),
                    element.findtext("financialData/closedYear/costs/amount", ""),
                    costs.get("currency", "") if costs is not None else "",
                )
            )
            interests.extend(
                (identifier, area.text or "") for area in element.findall("interests/interest/name")
            )
        element.clear()
    if expected == 0 or seen != expected:
        raise ValueError(f"EU register truncated: expected {expected}, read {seen}")
    con.executemany("insert into eu_register_raw values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)
    con.executemany("insert into eu_interests_raw values (?, ?)", interests)
    con.execute("set variable eu_exported = ?", [exported])


def validate(con: duckdb.DuckDBPyConnection) -> None:
    checks = {
        "HATVP exercise activity counts": """
            select count(*) from lobbying_exercises e
            where e.activities <> (select count(*) from lobbying_activities a
                                  where a.exercise_id = e.id)
        """,
        "HATVP duplicate organisations": """
            select count(*) - count(distinct identifier) from lobbying_organisations
        """,
        "HATVP duplicate activities": """
            select count(*) - count(distinct id) from lobbying_activities
        """,
        "EU duplicate identifiers": "select count(*) - count(distinct id) from eu_lobbying",
        "Party duplicate accounts": """
            select count(*) - count(distinct (code, year)) from party_accounts
        """,
        "Party resource partition": """
            select count(*) from party_accounts where abs(resources - members - elected
                - donations - public_aid - other_resources) > 0.01
        """,
        "Party official total resources": """
            select case when abs(
                (select sum(resources) from party_accounts) -
                (select sum(party_money(replace("Total_des_produits_I_+_III_+_V", ',', '.')))
                 from party_raw where Unite_monetaire = 'EUR')) > 0.01 then 1 else 0 end
        """,
        "Party retained accounts": """
            select (select count(*) from party_raw where Unite_monetaire = 'EUR')
                - (select count(*) from party_accounts)
        """,
    }
    for label, sql in checks.items():
        if con.execute(sql).fetchone() != (0,):
            raise ValueError(f"Democracy cross-check failed: {label}")
