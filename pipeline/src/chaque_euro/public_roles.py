import csv
import hashlib
import io
import json
import re
import tempfile
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from collections.abc import Iterable, Iterator
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Any

import duckdb

from .fetch import FetchRecord
from .municipal import decisions
from .registry import load_registry

SCHEMAS = {
    ("public_people"): (
        "id varchar, given_name varchar, family_name varchar, display_name "
        "varchar, role_kind varchar, chamber varchar, territory_code varchar, "
        "territory_label varchar, group_label varchar, active integer, "
        "hatvp_ref varchar, source_id varchar"
    ),
    ("public_organs"): (
        "chamber varchar, external_id varchar, kind varchar, label varchar, "
        "short_label varchar, starts_on varchar, ends_on varchar, source_id "
        "varchar"
    ),
    ("public_mandates"): (
        "id varchar, person_id varchar, kind varchar, chamber varchar, organ_id"
        " varchar, territory_code varchar, territory_label varchar, role_label "
        "varchar, starts_on varchar, ends_on varchar, date_precision varchar, "
        "source_id varchar"
    ),
    ("public_ballots"): (
        "id varchar, chamber varchar, number integer, session varchar, voted_on"
        " varchar, title varchar, result varchar, for_count integer, "
        "against_count integer, abstention_count integer, non_voting_count "
        "integer, announced_for integer, announced_against integer, source_id "
        "varchar"
    ),
    ("public_votes"): (
        "ballot_id varchar, person_id varchar, position varchar, group_id "
        "varchar, delegated integer, source_status varchar, source_id varchar"
    ),
    ("public_vote_corrections"): (
        "ballot_id varchar, ordinal integer, person_id varchar, "
        "intended_position varchar, source_id varchar"
    ),
    ("public_person_metrics"): (
        "person_id varchar, window_kind varchar, window_start varchar, window_end "
        "varchar, numerator integer, denominator integer, value double, "
        "source_id varchar"
    ),
    ("interest_declarations"): (
        "id varchar, person_id varchar, type varchar, modifying integer, "
        "filed_on varchar, published_on varchar, official_status varchar, "
        "document varchar, source_id varchar"
    ),
    ("declared_interests"): (
        "declaration_id varchar, section varchar, item_count integer, "
        "explicitly_none integer, source_id varchar"
    ),
    ("campaign_accounts"): (
        "election_id varchar, candidate_id varchar, candidate_name varchar, "
        "territory_code varchar, constituency varchar, decision_code varchar, "
        "decision_label varchar, declared_expenses_cents bigint, "
        "retained_expenses_cents bigint, declared_revenue_cents bigint, "
        "retained_revenue_cents bigint, personal_contribution_cents bigint, "
        "donations_cents bigint, party_contribution_cents bigint, in_kind_cents"
        " bigint, rfe_fixed_cents bigint, transport_fixed_cents bigint, "
        "devolution_cents bigint, published_on varchar, source_id varchar"
    ),
    ("campaign_account_lines"): (
        "election_id varchar, candidate_id varchar, ordinal integer, basis "
        "varchar, category varchar, amount_cents bigint, source_id varchar"
    ),
    ("campaign_decisions"): (
        "id varchar, candidate_name varchar, territory_label varchar, document "
        "varchar, rectifies_id varchar, coverage_status varchar, source_id "
        "varchar"
    ),
    ("rne_statistics"): (
        "mandate_kind varchar, department_code varchar, sex varchar, age_band "
        "varchar, records integer, data_date varchar, source_id varchar"
    ),
    ("local_executives"): (
        "id varchar, display_name varchar, role_label varchar, territory_code "
        "varchar, territory_label varchar, department_code varchar, starts_on "
        "varchar, data_date varchar, source_id varchar"
    ),
    ("cada_opinions"): (
        "dossier_id varchar, kind varchar, session_on varchar, favorable "
        "integer, unfavorable integer, other integer, source_id varchar"
    ),
    ("expense_reference_values"): (
        "id varchar, institution varchar, role_kind varchar, territory_category"
        " varchar, effective_on varchar, measure varchar, amount_cents bigint, "
        "unit varchar, gross_net varchar, value_kind varchar, document_locator "
        "varchar, source_id varchar"
    ),
    ("cabinet_statistics"): (
        "observed_on varchar, document_year integer, category varchar, value "
        "integer, unit varchar, document_locator varchar, source_id varchar"
    ),
    ("transparency_alerts"): (
        "id varchar, election_id varchar, candidate_id varchar, candidate_name "
        "varchar, territory_code varchar, rule varchar, official_status "
        "varchar, observed_on varchar, source_id varchar"
    ),
}

DECISIONS = {
    "A": "Approuvé",
    "AR": "Approuvé après réformation du compte",
    "ARM": "Approuvé après réformation, avec modulation du remboursement",
    "ARRR": "Approuvé après réformation, avec réduction du remboursement",
    "ARRRM": "Approuvé après réformation, avec réduction et modulation du remboursement",
    "ARR": "Approuvé avec réduction du remboursement",
    "AM": "Approuvé avec modulation du remboursement",
    "R": "Compte rejeté",
    "AD": "Absence de dépôt du compte",
    "HD": "Dépôt hors délai",
    "DD": "Dispensé de dépôt",
}
INTEREST_TYPES = {"di", "dim", "dia", "diam"}
INTEREST_SECTIONS = {
    "activConsultantDto": "Conseil",
    "activProfCinqDerniereDto": "Activités professionnelles",
    "participationDirigeantDto": "Fonctions dirigeantes",
    "participationFinanciereDto": "Participations financières déclarées",
    "mandatElectifDto": "Mandats électifs",
    "fonctionBenevoleDto": "Fonctions bénévoles",
}


def many(value: Any) -> list[Any]:
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def text(value: Any) -> str:
    return str(value.get("#text", "")) if isinstance(value, dict) else str(value or "")


def normalized(value: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", value).casefold() if c.isalnum())


def iso(value: str | None) -> str | None:
    if not value or not value.strip():
        return None
    value = value.strip()[:10]
    if re.fullmatch(r"\d{2}/\d{2}/\d{4}", value):
        value = f"{value[6:]}-{value[3:5]}-{value[:2]}"
    return value[:10]


def cents(value: str | None) -> int | None:
    if value is None or value.strip() in {"", "-", "\u2013", "n.c.", "NC"}:
        return None
    cleaned = re.sub(r"[\s€]", "", value).replace(",", ".")
    return int((Decimal(cleaned) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def table(
    con: duckdb.DuckDBPyConnection, name: str, schema: str, rows: Iterable[tuple[Any, ...]]
) -> None:
    columns = [c.strip().split()[0] for c in schema.split(",")]
    con.execute(f"create or replace table {name} ({schema})")
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", encoding="utf-8") as out:
        writer = csv.writer(out)
        writer.writerow(columns)
        count = 0
        for row in rows:
            writer.writerow([r if r is not None else r"\N" for r in row])
            count += 1
        out.flush()
        if count:
            con.execute(
                f"insert into {name} select * from read_csv(?, header=true, "
                "all_varchar=true, nullstr='\\N', max_line_size=1000000)",
                [out.name],
            )


def csv_rows(
    path: Path, encoding: str = "utf-8-sig", delimiter: str = ";", preamble: str | None = None
) -> Iterator[dict[str, str]]:
    with path.open(encoding=encoding, newline="") as handle:
        if preamble:
            for line in handle:
                if (
                    line.startswith("candidat;")
                    if preamble == "campaign"
                    else not line.startswith("%")
                ) and line.strip():
                    break
            else:
                raise ValueError(f"Missing CSV header: {path.name}")
            yield from csv.DictReader(io.StringIO(line + handle.read()), delimiter=delimiter)
        else:
            yield from csv.DictReader(handle, delimiter=delimiter)


def archive_json(path: str, kind: str) -> Iterator[dict[str, Any]]:
    with zipfile.ZipFile(path) as archive:
        for name in archive.namelist():
            if name.endswith(".json") and (f"/{kind}/" in name or kind == "scrutin"):
                data = json.loads(archive.read(name))
                yield data[kind]


def _an(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    people: dict[str, tuple[Any, ...]] = {}
    mandates: dict[str, tuple[Any, ...]] = {}
    organs: dict[str, tuple[Any, ...]] = {}
    for source in ("an-history", "an-members"):
        for organ in archive_json(records[source].path, "organe"):
            validity = organ.get("viMoDe") or {}
            organs[organ["uid"]] = (
                "AN",
                organ["uid"],
                organ["codeType"],
                organ["libelle"],
                organ.get("libelleAbrege"),
                validity.get("dateDebut"),
                validity.get("dateFin"),
                source,
            )
        for actor in archive_json(records[source].path, "acteur"):
            actor_id = text(actor["uid"])
            offices = many((actor.get("mandats") or {}).get("mandat"))
            eligible = any(
                (m["typeOrgane"] == "ASSEMBLEE" and str(m.get("legislature")) == "17")
                or m["typeOrgane"] in {"MINISTERE", "GOUVERNEMENT"}
                for m in offices
            )
            if not eligible:
                continue
            identity = actor["etatCivil"]["ident"]
            hatvp = text(actor.get("uri_hatvp"))
            ref = re.search(r"/pages_nominatives/([a-z0-9-]+)/?$", hatvp)
            people[actor_id] = (
                actor_id,
                identity["prenom"],
                identity["nom"],
                f"{identity['prenom']} {identity['nom']}",
                None,
                "AN",
                None,
                None,
                None,
                0,
                ref[1] if ref else None,
                source,
            )
            for mandate in offices:
                kind = mandate["typeOrgane"]
                if kind not in {"ASSEMBLEE", "GP", "COMPER", "COMNL", "MINISTERE", "GOUVERNEMENT"}:
                    continue
                if kind == "ASSEMBLEE" and str(mandate.get("legislature")) != "17":
                    continue
                place = (mandate.get("election") or {}).get("lieu") or {}
                refs = many((mandate.get("organes") or {}).get("organeRef"))
                mandates[mandate["uid"]] = (
                    mandate["uid"],
                    actor_id,
                    kind,
                    "AN",
                    text(refs[0]) if refs else None,
                    place.get("numDepartement"),
                    place.get("departement"),
                    (mandate.get("infosQualite") or {}).get("libQualite"),
                    mandate.get("dateDebut"),
                    mandate.get("dateFin"),
                    "day",
                    source,
                )
    table(con, "people_raw", SCHEMAS["public_people"], people.values())
    table(con, "mandates_raw", SCHEMAS["public_mandates"], mandates.values())
    table(con, "organs_raw", SCHEMAS["public_organs"], organs.values())


def _senate(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    root = Path(records["senat-members"].path)
    rows = list(csv_rows(root / "general.csv", "cp1252", ",", "senate"))
    people = [
        (
            "SEN" + r["Matricule"],
            r["Prénom usuel"],
            r["Nom usuel"],
            f"{r['Prénom usuel']} {r['Nom usuel']}",
            "senator",
            "SENAT",
            None,
            r["Circonscription"],
            r["Groupe politique"] or None,
            int(r["État"] == "ACTIF"),
            None,
            "senat-members",
        )
        for r in rows
    ]
    table(con, "senate_people", SCHEMAS["public_people"], people)
    offices: list[tuple[Any, ...]] = []
    for r in csv_rows(root / "mandates.csv", "cp1252", ",", "senate"):
        start = iso(r["Date de début de mandat"])
        end = iso(r["Date de fin de mandat"])
        precision = "day" if start and (end or not r["Année de fin de mandat"]) else "year"
        offices.append(
            (
                "SEN-M" + r["Identifiant mandat"],
                "SEN" + r["Matricule"],
                "SENAT",
                "SENAT",
                None,
                None,
                None,
                "Sénateur ou sénatrice",
                start or r["Année de début de mandat"] or None,
                end or r["Année de fin de mandat"] or None,
                precision,
                "senat-members",
            )
        )
    groups = {}
    for r in csv_rows(root / "groups.csv", "cp1252", ",", "senate"):
        gid = r["Code du groupe politique"]
        groups[gid] = (
            "SENAT",
            gid,
            "GP",
            r["Nom court du groupe politique"],
            r["Nom court du groupe politique"],
            None,
            None,
            "senat-members",
        )
        offices.append(
            (
                "SEN-G" + r["Id appartenance"] + "-" + r["Id fonction occupée"],
                "SEN" + r["Matricule"],
                "GP",
                "SENAT",
                gid,
                None,
                None,
                r["Nom court fonction"],
                iso(r["Date de début d'appartenance"]),
                iso(r["Date de fin d'appartenance"]),
                "day",
                "senat-members",
            )
        )
    table(con, "senate_mandates", SCHEMAS["public_mandates"], offices)
    table(con, "senate_organs", SCHEMAS["public_organs"], groups.values())


def _an_votes(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    ballots = []
    corrections: list[tuple[Any, ...]] = []

    def votes() -> Iterator[tuple[Any, ...]]:
        for b in archive_json(records["an-votes"].path, "scrutin"):
            counts = (b.get("syntheseVote") or {}).get("decompte") or {}
            ballots.append(
                (
                    b["uid"],
                    "AN",
                    int(b["numero"]),
                    "17",
                    b["dateScrutin"],
                    b["titre"],
                    (b.get("sort") or {}).get("libelle"),
                    counts.get("pour"),
                    counts.get("contre"),
                    counts.get("abstentions"),
                    counts.get("nonVotants"),
                    None,
                    None,
                    "an-votes",
                )
            )
            groups = ((b.get("ventilationVotes") or {}).get("organe") or {}).get("groupes") or {}
            for group in many(groups.get("groupe")):
                nominal = (group.get("vote") or {}).get("decompteNominatif") or {}
                for key, position in (
                    ("pours", "pour"),
                    ("contres", "contre"),
                    ("abstentions", "abstention"),
                    ("nonVotants", "non-votant"),
                ):
                    for voter in many((nominal.get(key) or {}).get("votant")):
                        yield (
                            b["uid"],
                            voter["acteurRef"],
                            position,
                            group["organeRef"],
                            int(voter.get("parDelegation") == "true"),
                            "position publiée",
                            "an-votes",
                        )
            point = b.get("miseAuPoint") or {}
            for key, position in (
                ("pours", "pour"),
                ("contres", "contre"),
                ("abstentions", "abstention"),
                ("nonVotants", "non-votant"),
            ):
                for item in many(point.get(key)):
                    if not isinstance(item, dict):
                        continue
                    for voter in many(item.get("votant")):
                        corrections.append(
                            (
                                b["uid"],
                                len(corrections) + 1,
                                text(voter["acteurRef"]),
                                position,
                                "an-votes",
                            )
                        )

    table(con, "votes_raw", SCHEMAS["public_votes"], votes())
    table(con, "ballots_raw", SCHEMAS["public_ballots"], ballots)
    table(con, "corrections_raw", SCHEMAS["public_vote_corrections"], corrections)


def copy_rows(path: str, wanted: set[str]) -> Iterator[tuple[str, dict[str, str | None]]]:
    with zipfile.ZipFile(path) as archive, archive.open(archive.namelist()[0]) as raw:
        stream = io.TextIOWrapper(raw, encoding="utf-8")
        columns: list[str] = []
        name = ""
        for line in stream:
            if line.startswith("COPY "):
                match = re.fullmatch(r"COPY (?:public\.)?(\w+) \(([^)]+)\) FROM stdin;\n", line)
                name = match[1] if match and match[1] in wanted else ""
                columns = match[2].split(", ") if name and match else []
            elif line.rstrip() == r"\.":
                name = ""
            elif name:
                values = line.rstrip("\n").split("\t")
                if len(values) != len(columns):
                    raise ValueError(f"Invalid COPY row in {name}")

                def unescape(value: str) -> str | None:
                    if value == r"\N":
                        return None
                    return re.sub(
                        r"\\([\\tnr])",
                        lambda m: {"t": "\t", "n": "\n", "r": "\r", "\\": "\\"}[m[1]],
                        value,
                    )

                yield name, dict(zip(columns, map(unescape, values), strict=True))


def _senate_votes(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    ballots = []
    ids = set()
    statuses = {}
    for name, r in copy_rows(records["senat-votes"].path, {"scr", "stavot"}):
        if name == "stavot":
            statuses[r["stavotidt"]] = r["stavotlib"]
            continue
        day = iso(r["scrdat"])
        if not day or day < "2024-07-08":
            continue
        bid = f"SEN{r['sesann']}-{r['scrnum']}"
        ids.add(bid)
        ballots.append(
            (
                bid,
                "SENAT",
                int(r["scrnum"] or "0"),
                r["sesann"],
                day,
                r["scrint"],
                r["soslib"],
                r["scrpou"],
                r["scrcon"],
                int(r["scrvot"] or "0") - int(r["scrsuf"] or "0"),
                None,
                r["scrpousea"],
                r["scrconsea"],
                "senat-votes",
            )
        )
    corrections: list[tuple[Any, ...]] = []
    positions = {"1": "pour", "2": "contre", "3": "abstention", "4": "non-votant"}

    def votes() -> Iterator[tuple[Any, ...]]:
        for name, r in copy_rows(records["senat-votes"].path, {"votsen", "corscr"}):
            bid = f"SEN{r['sesann']}-{r['scrnum']}"
            if bid not in ids:
                continue
            if name == "corscr":
                corrections.append(
                    (
                        bid,
                        int(r["corscrord"] or "0"),
                        None,
                        "Rectification publiée : consulter le scrutin officiel",
                        "senat-votes",
                    )
                )
            else:
                yield (
                    bid,
                    "SEN" + (r["senmat"] or ""),
                    positions[r["posvotcod"] or ""],
                    None,
                    int(bool(r["senmatdel"])),
                    statuses.get(r["stavotidt"]),
                    "senat-votes",
                )

    table(con, "senate_votes", SCHEMAS["public_votes"], votes())
    table(con, "senate_ballots", SCHEMAS["public_ballots"], ballots)
    table(con, "senate_corrections", SCHEMAS["public_vote_corrections"], corrections)


def xlsx_rows(path: str) -> Iterator[dict[str, str]]:
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(path) as archive:
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = [
                "".join(n.itertext())
                for n in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("m:si", ns)
            ]
        root = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        for row in root.findall("m:sheetData/m:row", ns):
            cells = {}
            for cell in row.findall("m:c", ns):
                value = cell.findtext("m:v", "", ns)
                if cell.get("t") == "s":
                    value = strings[int(value)] if value else ""
                elif cell.get("t") == "inlineStr":
                    inline = cell.find("m:is", ns)
                    value = "".join(inline.itertext()) if inline is not None else ""
                cells[re.sub(r"\d", "", cell.get("r", ""))] = value
            yield cells


def _campaigns(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    accounts = []
    lines = []
    for r in csv_rows(Path(records["cnccfp-leg2024"].path), "cp1252", ";", "campaign"):
        code = r["decision"].strip()
        department = r["code département"].zfill(2)
        accounts.append(
            (
                "legislatives-2024",
                r["candidat"],
                r["nom"],
                department,
                r["circonscription"],
                code,
                DECISIONS[code],
                *[
                    cents(r[k])
                    for k in [
                        "dépenses totales déclarées",
                        "depenses totales retenues",
                        "recettes totales déclarées",
                        "recettes totales retenues",
                        "apport personnel retenu",
                        "dons retenus",
                        "apport retenu",
                        "concours retenus",
                        "RFE",
                        "FT",
                        "dévolution",
                    ]
                ],
                "2025-07-22",
                "cnccfp-leg2024",
            )
        )
        for ordinal, (k, v) in enumerate(r.items()):
            if k.endswith(("(déclaré)", "(retenu)")):
                lines.append(
                    (
                        "legislatives-2024",
                        r["candidat"],
                        ordinal,
                        "declared" if k.endswith("(déclaré)") else "retained",
                        k.rsplit(" (", 1)[0].replace("Ã\xa0", "à"),
                        cents(v),
                        "cnccfp-leg2024",
                    )
                )
    current: dict[str, Any] | None = None

    def finish() -> None:
        if not current:
            return
        first, last = current["first"], current["last"]
        code = last.get("R", "").strip()
        if code not in DECISIONS:
            raise ValueError("Unknown European campaign decision")
        accounts.append(
            (
                "europeennes-2024",
                current["id"],
                current["name"],
                "FR",
                "Circonscription nationale",
                code,
                DECISIONS[code],
                cents(first.get("B")),
                cents(last.get("B")),
                cents(first.get("C")),
                cents(last.get("C")),
                *[cents(last.get(k)) for k in ["H", "D", "E", "F", "Q"]],
                None,
                cents(last.get("P")),
                "2025-04-30",
                "cnccfp-eu2024",
            )
        )

    for ordinal, r in enumerate(xlsx_rows(records["cnccfp-eu2024"].path), 1):
        if ordinal <= 6:
            continue
        if r.get("A", "").strip():
            finish()
            name = re.sub(r"\s*\(\*+\)", "", r["A"]).strip()
            current = {"id": f"EU2024-{ordinal}", "name": name, "first": r, "last": r}
        elif current and (r.get("B") or r.get("R")):
            current["last"] = r
        if current:
            basis = "declared" if current["first"] is r else "retained"
            for key, category in [
                ("B", "Dépenses totales"),
                ("C", "Recettes totales"),
                ("D", "Dons"),
                ("E", "Apports des partis"),
                ("F", "Concours en nature"),
                ("H", "Apport personnel"),
            ]:
                lines.append(
                    (
                        "europeennes-2024",
                        current["id"],
                        ordinal,
                        basis,
                        category,
                        cents(r.get(key)),
                        "cnccfp-eu2024",
                    )
                )
    finish()
    table(con, "campaign_accounts_raw", SCHEMAS["campaign_accounts"], accounts)
    table(con, "campaign_lines_raw", SCHEMAS["campaign_account_lines"], lines)


def _interests(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    root = Path(records["hatvp-interests"].path)
    identities = {
        row[0]: row[1:]
        for row in con.execute(
            "select id, given_name, family_name from people_raw union all select "
            "id, given_name, family_name from senate_people"
        ).fetchall()
    }
    government_refs: dict[tuple[str, str, str], list[str]] = {}
    government = con.execute(
        "select distinct p.id,p.given_name,p.family_name,o.label from people_raw p "
        "join mandates_raw m on m.person_id=p.id "
        "join organs_raw o on o.external_id=m.organ_id and o.chamber=m.chamber "
        "where m.kind='MINISTERE' and m.starts_on<=getvariable('democracy_as_of') "
        "and (m.ends_on is null or m.ends_on>=getvariable('democracy_as_of'))"
    ).fetchall()
    for pid, given, family, office in government:
        government_key = (
            normalized(given),
            normalized(family),
            normalized(office).replace("ministere", "ministre"),
        )
        government_refs.setdefault(government_key, []).append(pid)
    declarations = []
    index: dict[tuple[str, str, str, str], list[str]] = {}
    for r in csv_rows(root / "inventory.csv"):
        kind = r["type_document"].lower()
        if (
            kind not in INTEREST_TYPES
            or r["statut_publication"] != "Livrée"
            or not r["date_publication"]
        ):
            continue
        role = r["type_mandat"]
        if role == "gouvernement":
            government_key = (
                normalized(r["prenom"]),
                normalized(r["nom"]),
                normalized(r["qualite"]),
            )
            ids = government_refs.get(government_key, [])
            page = re.fullmatch(r"/pages_nominatives/([a-z0-9-]+)", r["url_dossier"])
            if len(ids) == 1 and page:
                con.execute(
                    "update people_raw set hatvp_ref=? where id=? and hatvp_ref is null",
                    [page[1], ids[0]],
                )
            continue
        if not re.fullmatch(r"[a-zA-Z0-9_-]+\.xml", r["open_data"]):
            continue
        pid = (
            "PA" + r["id_origine"]
            if role == "depute"
            else "SEN" + r["id_origine"]
            if role == "senateur"
            else ""
        )
        identity = identities.get(pid)
        if (
            not identity
            or normalized(identity[0]) != normalized(r["prenom"])
            or normalized(identity[1]) != normalized(r["nom"])
        ):
            continue
        key = (normalized(r["prenom"]), normalized(r["nom"]), r["date_depot"], role)
        index.setdefault(key, []).append(r["open_data"])
        declarations.append(
            (
                r["open_data"],
                pid,
                kind.upper(),
                int(kind.endswith("m")),
                r["date_depot"],
                r["date_publication"],
                r["statut_publication"],
                r["open_data"],
                "hatvp-interests",
            )
        )
    summaries = []
    matched: Counter[str] = Counter()
    for _, node in ET.iterparse(root / "declarations.xml", events=("end",)):
        if node.tag != "declaration":
            continue
        if node.findtext("general/typeDeclaration/id") in {"DI", "DIA"}:
            key = (
                normalized(node.findtext("general/declarant/prenom", "")),
                normalized(node.findtext("general/declarant/nom", "")),
                iso(node.findtext("dateDepot")) or "",
                node.findtext("general/qualiteMandat/codTypeMandatFichier", ""),
            )
            ids = index.get(key, [])
            if len(ids) == 1:
                did = ids[0]
                matched[did] += 1
                for section, label in INTEREST_SECTIONS.items():
                    part = node.find(section)
                    if part is not None:
                        items = part.findall("items/items")
                        summaries.append(
                            (
                                did,
                                label,
                                len(items),
                                int(part.findtext("neant") == "true"),
                                "hatvp-interests",
                            )
                        )
        node.clear()
    table(
        con,
        "interests_raw",
        SCHEMAS["interest_declarations"],
        (r for r in declarations if matched[r[0]] == 1),
    )
    table(
        con,
        "interest_sections_raw",
        SCHEMAS["declared_interests"],
        (r for r in summaries if matched[r[0]] == 1),
    )


def _rne(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    root = Path(records["rne"].path)
    source = next(s for s in load_registry() if s.id == "rne")
    counts: Counter[tuple[str, str, str, str, str]] = Counter()
    executives = []
    departments: dict[str, str] = {}
    for name, source_url in source.files.items():
        kind = name.removesuffix(".csv")
        vintage = re.search(r"/(\d{4})(\d{2})(\d{2})-", source_url)
        if vintage is None:
            raise ValueError("RNE vintage missing")
        observed = date(*map(int, vintage.groups()))
        for r in csv_rows(root / name):
            born = iso(r.get("Date de naissance"))
            age = None
            if born:
                birthday = date.fromisoformat(born)
                age = (
                    observed.year
                    - birthday.year
                    - ((observed.month, observed.day) < (birthday.month, birthday.day))
                )
            band = (
                "Inconnu"
                if age is None
                else "Moins de 30 ans"
                if age < 30
                else "30 à 44 ans"
                if age < 45
                else "45 à 59 ans"
                if age < 60
                else "60 à 74 ans"
                if age < 75
                else "75 ans et plus"
            )
            department = r.get("Code du département") or "Non renseigné"
            if r.get("Code du département") and r.get("Libellé du département"):
                departments[r["Code du département"]] = r["Libellé du département"]
            sex = {"M": "Hommes", "F": "Femmes"}.get(r.get("Code sexe", ""), "Non renseigné")
            counts[(kind, department, sex, band, observed.isoformat())] += 1
            if kind == "mai":
                territory = r["Code de la commune"]
                display = r["Prénom de l'élu"] + " " + r["Nom de l'élu"]
                started = r.get("Date de début de la fonction") or r.get("Date de début du mandat")
                digest = hashlib.sha256(
                    f"{kind}|{territory}|{display}|{started}".encode()
                ).hexdigest()[:20]
                executives.append(
                    (
                        "RNE" + digest,
                        display,
                        "Maire",
                        territory,
                        r["Libellé de la commune"],
                        department,
                        started,
                        observed.isoformat(),
                        "rne",
                    )
                )
    table(
        con,
        "rne_statistics_raw",
        SCHEMAS["rne_statistics"],
        (
            (kind, department, sex, band, count, vintage, "rne")
            for (kind, department, sex, band, vintage), count in counts.items()
        ),
    )
    table(con, "local_executives_raw", SCHEMAS["local_executives"], executives)

    table(con, "department_labels_raw", "code varchar, name varchar", departments.items())


def _cada(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    csv.field_size_limit(10_000_000)
    rows = {}
    for r in csv_rows(Path(records["cada"].path), delimiter=","):
        if r["Type"] not in {"Avis", "Conseil"}:
            continue
        sense = r["Sens et motivation"].casefold()
        favorable = int(bool(re.search(r"(?<!dé)(?<!in)(?<!non )favorable", sense)))
        unfavorable = int("défavorable" in sense or "defavorable" in sense)
        rows[r["Numéro de dossier"]] = (
            r["Numéro de dossier"],
            r["Type"],
            iso(r["Séance"]),
            favorable,
            unfavorable,
            int(not favorable and not unfavorable),
            "cada",
        )
    table(con, "cada_raw", SCHEMAS["cada_opinions"], rows.values())


def load(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    con.execute("set variable democracy_as_of = ?", [records["an-members"].retrieved_at[:10]])
    _an(con, records)
    _senate(con, records)
    _an_votes(con, records)
    _senate_votes(con, records)
    _campaigns(con, records)
    _interests(con, records)
    _rne(con, records)
    _cada(con, records)

    table(
        con,
        "municipal_raw",
        SCHEMAS["campaign_decisions"],
        decisions(Path(records["cnccfp-mun2026"].path)),
    )


def validate(con: duckdb.DuckDBPyConnection) -> None:
    checks = [
        (
            (
                "select count(*) from interest_declarations where type not in "
                "('DI','DIM','DIA','DIAM')"
            ),
            "HATVP type allowlist",
        ),
        (
            (
                "select count(*) from public_votes where position not in "
                "('pour','contre','abstention','non-votant')"
            ),
            "Vote positions",
        ),
        (
            (
                "select count(*) from (select ballot_id,person_id from public_votes "
                "group by all having count(*)>1)"
            ),
            "Duplicate nominal votes",
        ),
        (
            (
                "select count(*) from public_person_metrics where numerator>denominator"
                " or denominator<0"
            ),
            "Mandate-bounded participation",
        ),
        (
            "select count(*) from cada_opinions where kind not in ('Avis','Conseil')",
            "CADA sanctions excluded",
        ),
    ]
    for query, message in checks:
        row = con.execute(query).fetchone()
        if row and row[0]:
            raise ValueError(message)
