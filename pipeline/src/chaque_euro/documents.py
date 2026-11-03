import io
import json
import re
import tarfile
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from collections.abc import Iterator
from datetime import UTC, date, datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import duckdb

from .fetch import FetchRecord
from .registry import Source, load_registry

TABLES = {
    "official_journals": (
        "id varchar, publication_date varchar, issue_number varchar, "
        "source_reference_count integer, excluded_reference_count integer, "
        "missing_reference_count integer, source_file varchar"
    ),
    "official_texts": (
        "id varchar, journal_id varchar, publication_date varchar, nature varchar, "
        "title_public varchar, nor varchar, ministry_label varchar, "
        "authority_label varchar, appointment_class varchar, "
        "classification_version varchar, record_url varchar, source_file varchar"
    ),
    "legislative_files": (
        "id varchar, title_public varchar, kind varchar, legislature varchar, "
        "status varchar, source_id varchar, source_modified_at varchar, "
        "record_url varchar"
    ),
    "legislative_file_refs": (
        "file_id varchar, source_id varchar, external_id varchar, record_url varchar, "
        "source_status varchar, source_file varchar"
    ),
    "legislative_events": (
        "id varchar, file_id varchar, parent_id varchar, chamber varchar, "
        "label_public varchar, event_at varchar, temporal_status varchar, "
        "outcome varchar, source_order integer, record_url varchar, source_id varchar"
    ),
    "legislative_documents": (
        "id varchar, file_id varchar, event_id varchar, kind varchar, "
        "title_public varchar, record_url varchar, source_id varchar"
    ),
    "budget_legislation": (
        "file_id varchar, fiscal_year integer, law_kind varchar, budget_family varchar, "
        "match_method varchar"
    ),
    "administrations": (
        "id varchar, name_public varchar, acronym varchar, category varchar, "
        "organism_type varchar, siren varchar, commune_code varchar, record_url varchar, "
        "source_modified_at varchar, source_id varchar"
    ),
    "administration_relations": (
        "parent_id varchar, child_id varchar, relation_type varchar, source_id varchar"
    ),
    "administration_pivots": (
        "administration_id varchar, pivot_code varchar, commune_code varchar"
    ),
    "administration_coverage": (
        "commune_code varchar, pivot_code varchar, administration_id varchar"
    ),
}


def normalized(value: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", value.lower()) if not unicodedata.combining(c)
    ).replace("\u2019", "'")


def protected(title: str) -> bool:
    value = normalized(title)
    return bool(
        re.search(
            r"acces\s+protege|changements?\s+de\s+nom|naturalis|reintegr.*nationalite|"
            r"(?:acquisition|perte|decheance).*nationalite|liberat.*liens d.allegeance|"
            r"francisation|attribution.*prenom|"
            r"(?:exclusion|suspension|retrait|abrogation).*"
            r"(?:legion d'honneur|medaille militaire|ordre national du merite)|"
            r"condamnation[s]? penale|sanction[s]? (?:administrative|disciplinaire)",
            value,
        )
    )


def appointment(title: str) -> str:
    value = normalized(title)
    for pattern, label in (
        (r"(?:portant|relatif a la) (?:renouvellement|reconduction)", "renouvellement"),
        (r"(?:portant|relatif a la) (?:cessation|fin de fonctions)", "cessation"),
        (r"(?:portant|relatif a la) (?:admission.*retraite|radiation)", "retraite"),
        (r"(?:portant|relatif a la) designation", "désignation"),
        (r"(?:portant|relatif a la) nomination", "nomination"),
    ):
        if re.search(pattern, value):
            return label
    return "autre"


def text(node: ET.Element, path: str) -> str:
    return " ".join("".join(node.findtext(path, default="")).split()).replace("\u2014", ",")


def xml_records(path: str) -> Iterator[tuple[str, ET.Element]]:
    for archive in sorted(
        Path(path).glob("*.tar.gz"),
        key=lambda item: (not item.name.startswith("Freemium_"), item.name),
    ):
        with tarfile.open(archive) as handle:
            for member in handle:
                if not member.isfile():
                    continue
                if "supprim" in member.name.lower() or "delete" in member.name.lower():
                    raise ValueError(f"Unrecognized withdrawal delivery: {archive.name}")
                if not member.name.endswith(".xml"):
                    continue
                if member.size > 32_000_000:
                    raise ValueError(f"Oversized XML: {archive.name}")
                stream = handle.extractfile(member)
                assert stream is not None
                yield archive.name, ET.fromstring(stream.read())


def _url(source: Source, identifier: str) -> str:
    assert source.record_url
    return source.record_url.replace("{id}", identifier)


def _safe_url(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urlparse(value.strip())
    if parsed.scheme not in {"http", "https"} or parsed.username or parsed.password:
        return None
    return value.strip()


def journals(path: str, source: Source, today: date) -> dict[str, list[tuple[Any, ...]]]:
    texts: dict[str, tuple[Any, ...]] = {}
    excluded_ids: set[str] = set()
    issues: dict[str, tuple[str, ET.Element]] = {}
    for filename, root in xml_records(path):
        identifier = text(root, "ID")
        if root.tag == "JO":
            issues[identifier] = (filename, root)
        elif root.tag == "TEXTE":
            title = text(root, "TITREFULL") or text(root, "TITRE")
            if protected(title) or "acces protege" in normalized(" ".join(root.itertext())):
                excluded_ids.add(identifier)
                texts.pop(identifier, None)
                continue
            journal = root.find("ORIGINE_PUBLI")
            publication = text(root, "DATE_PUBLI")
            if not publication or publication > today.isoformat():
                continue
            excluded_ids.discard(identifier)
            category = appointment(title)
            if category == "nomination" and re.search(
                r"\b(?:(?:ne|nee)\s+(?:le|a)|domicilie|demeurant)\b", normalized(title)
            ):
                title = f"{text(root, 'NATURE')} : mesure individuelle ({category})"
            may_name = category == "nomination" and text(root, "NATURE") in {"DECRET", "ARRETE"}
            if not may_name and re.search(
                r"\b(?:M{1,2}\.|Mmes?|Mlles?|Monsieur|Madame|Messieurs|Mesdames)\s", title
            ):
                title = f"{text(root, 'NATURE')} : mesure individuelle ({category})"
            texts[identifier] = (
                identifier,
                journal.get("id", "") if journal is not None else "",
                publication,
                text(root, "NATURE") or "Non renseigné",
                title,
                text(root, "NOR") or None,
                text(root, "MINISTERE"),
                text(root, "AUTORITE") or None,
                category,
                "titre-v1",
                _url(source, identifier),
                filename,
            )
    selected = sorted(
        (
            (identifier, filename, root)
            for identifier, (filename, root) in issues.items()
            if text(root, "DATE_PUBLI") <= today.isoformat()
        ),
        key=lambda row: text(row[2], "DATE_PUBLI"),
        reverse=True,
    )[:30]
    public: dict[str, tuple[Any, ...]] = {}
    rows = []
    for identifier, filename, root in selected:
        refs: dict[str, tuple[str, str]] = {}

        def walk(
            node: ET.Element,
            ministry: str = "",
            refs: dict[str, tuple[str, str]] = refs,
        ) -> None:
            heading = text(node, "TITRE_TM")
            if normalized(heading).startswith(("ministere", "premier ministre", "presidence")):
                ministry = heading
            for child in node:
                if child.tag == "LIEN_TXT":
                    refs[child.get("idtxt", "")] = (child.get("titretxt", ""), ministry)
                elif child.tag in {"TM", "STRUCTURE_TXT"}:
                    walk(child, ministry)

        walk(root)
        excluded = missing = 0
        for key, (title, ministry) in refs.items():
            if protected(title) or key in excluded_ids:
                excluded += 1
            elif key not in texts:
                missing += 1
            else:
                row = list(texts[key])
                row[1] = identifier
                row[6] = row[6] or ministry or "Non renseigné"
                public[key] = tuple(row)
        rows.append(
            (
                identifier,
                text(root, "DATE_PUBLI"),
                text(root, "NUM"),
                len(refs),
                excluded,
                missing,
                filename,
            )
        )
    return {"official_journals": rows, "official_texts": list(public.values())}


def as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, str):
        value = json.loads(value)
    return value if isinstance(value, list) else [value]


def temporal(value: str | None, today: date) -> str:
    if not value:
        return "indéterminé"
    return "annoncé" if value[:10] > today.isoformat() else "réalisé"


def an_files(path: str, source: Source, today: date) -> dict[str, list[tuple[Any, ...]]]:
    events: list[tuple[Any, ...]] = []
    files, documents, refs, budgets = [], [], [], []
    with zipfile.ZipFile(path) as archive:
        document_index = {}
        for name in archive.namelist():
            if "/document/" in name and name.endswith(".json"):
                value = json.loads(archive.read(name)).get("document", {})
                document_index[value.get("uid")] = value
        for name in archive.namelist():
            if "/dossierParlementaire/" not in name or not name.endswith(".json"):
                continue
            dossier = json.loads(archive.read(name))["dossierParlementaire"]
            if (
                dossier.get("@xsi:type") != "DossierLegislatif_Type"
                or str((dossier.get("procedureParlementaire") or {}).get("code")) == "16"
            ):
                continue
            identifier = "an-" + dossier["uid"]
            titles = dossier["titreDossier"]
            title = titles.get("titre") or "Titre non renseigné"
            if protected(title):
                continue
            url = _url(source, titles["titreChemin"])
            procedure = dossier.get("procedureParlementaire") or {}
            kind = procedure.get("libelle") or "Non renseigné"
            files.append(
                (
                    identifier,
                    title,
                    kind,
                    dossier.get("legislature"),
                    "Non renseigné",
                    source.id,
                    None,
                    url,
                )
            )
            refs.append(
                (identifier, source.id, dossier["uid"], url, "Non renseigné", Path(path).name)
            )
            years = re.findall(r"\b(20\d{2})\b", title)
            if years and str(procedure.get("code")) in {"3", "4", "21"}:
                law = (
                    "PLFSS"
                    if str(procedure["code"]) == "4"
                    else "PLF"
                    if str(procedure["code"]) == "3"
                    else "Loi de finances rectificative"
                )
                budgets.append(
                    (
                        identifier,
                        int(years[-1]),
                        law,
                        "Sécurité sociale" if law == "PLFSS" else "État",
                        "Type et procédure Assemblée nationale",
                    )
                )

            def walk(
                value: Any,
                parent: str | None = None,
                identifier: str = identifier,
                url: str = url,
            ) -> None:
                for node in as_list(value):
                    event_id = "an-" + node["uid"]
                    code = node.get("codeActe") or ""
                    label = (node.get("libelleActe") or {}).get("nomCanonique") or code
                    event_date = node.get("dateActe")
                    outcome = (node.get("statutConclusion") or {}).get("libelle")
                    events.append(
                        (
                            event_id,
                            identifier,
                            parent,
                            "Sénat"
                            if code.startswith("SN")
                            else "Assemblée nationale"
                            if code.startswith("AN")
                            else "Autre institution",
                            label,
                            event_date,
                            temporal(event_date, today),
                            outcome,
                            len(events),
                            url,
                            source.id,
                        )
                    )
                    for key in ("texteAssocie", "texteAdopte"):
                        doc = document_index.get(node.get(key), {})
                        doc_url = _safe_url(doc.get("urlDocument"))
                        if doc_url:
                            doc_title = doc.get("titres", {}).get("titrePrincipal") or label
                            documents.append(
                                (
                                    source.id + "-" + str(node[key]) + "-" + event_id,
                                    identifier,
                                    event_id,
                                    key,
                                    doc_title,
                                    doc_url,
                                    source.id,
                                )
                            )
                    walk((node.get("actesLegislatifs") or {}).get("acteLegislatif"), event_id)

            walk((dossier.get("actesLegislatifs") or {}).get("acteLegislatif"))
    return {
        "legislative_files": files,
        "legislative_events": events,
        "legislative_documents": documents,
        "legislative_file_refs": refs,
        "budget_legislation": budgets,
    }


def dole_files(path: str, source: Source, today: date) -> dict[str, list[tuple[Any, ...]]]:
    latest = {
        text(root, "META/META_COMMUN/ID"): (filename, root) for filename, root in xml_records(path)
    }
    files, refs, events = [], [], []
    for external, (filename, root) in latest.items():
        meta = root.find("META/META_DOSSIER_LEGISLATIF")
        if meta is None:
            continue
        identifier = "dole-" + external
        title, kind = text(meta, "TITRE"), text(meta, "TYPE")
        if protected(title):
            continue
        status = "Promulgué" if kind == "LOI_PUBLIEE" else "Non renseigné"
        url = _url(source, external)
        files.append(
            (
                identifier,
                title,
                kind,
                text(meta, "LEGISLATURE/NUMERO"),
                status,
                source.id,
                text(meta, "DATE_DERNIERE_MODIFICATION"),
                url,
            )
        )
        refs.append((identifier, source.id, external, url, status, filename))
        for index, link in enumerate(root.findall(".//ARBORESCENCE//LIEN")):
            link_url = _safe_url(link.get("lien"))
            if link_url:
                events.append(
                    (
                        f"{identifier}-{index}",
                        identifier,
                        None,
                        "Lien documentaire",
                        link.get("libelle") or "Document officiel",
                        None,
                        "indéterminé",
                        None,
                        index,
                        link_url,
                        source.id,
                    )
                )
    return {"legislative_files": files, "legislative_file_refs": refs, "legislative_events": events}


def copy_rows(path: str, selected: set[str]) -> dict[str, list[dict[str, str | None]]]:
    tables: dict[str, list[dict[str, str | None]]] = {name: [] for name in selected}
    with zipfile.ZipFile(path) as archive:
        name = next(n for n in archive.namelist() if n.endswith(".sql"))
        with io.TextIOWrapper(archive.open(name), encoding="utf-8") as stream:
            table = ""
            columns: list[str] = []
            for line in stream:
                match = re.match(r"COPY (?:public\.)?(\w+) \(([^)]+)\) FROM stdin;", line)
                if match:
                    table = match[1]
                    columns = match[2].split(", ")
                elif line.rstrip() == r"\.":
                    table = ""
                elif table in tables:
                    cells = line.rstrip("\n").split("\t")
                    if len(cells) != len(columns):
                        raise ValueError(f"COPY column mismatch: {table}")

                    def decode(value: str) -> str | None:
                        if value == r"\N":
                            return None
                        return re.sub(
                            r"\\([0-7]{1,3}|.)",
                            lambda m: (
                                chr(int(m[1], 8))
                                if m[1].isdigit()
                                else {
                                    "t": "\t",
                                    "n": "\n",
                                    "r": "\r",
                                    "b": "\b",
                                    "f": "\f",
                                    "v": "\v",
                                    "\\": "\\",
                                }.get(m[1], m[1])
                            ),
                            value,
                        ).strip()

                    tables[table].append(dict(zip(columns, map(decode, cells), strict=True)))
    return tables


def senate_files(path: str, source: Source, today: date) -> dict[str, list[tuple[Any, ...]]]:
    tables = copy_rows(path, {"loi", "lecture", "lecass", "texte", "typtxt"})
    events: list[tuple[Any, ...]] = []
    files, refs, budgets, documents = [], [], [], []
    statuses = {
        "01": "En discussion",
        "02": "Fusionné",
        "03": "Rejeté",
        "04": "Promulgué",
        "05": "Caduc",
        "06": "Retiré",
    }
    laws = {}
    for law in tables["loi"]:
        if law["typloicod"] not in {
            "pjl",
            "ppl",
            "pplo",
            "pplc",
            "pjlo",
            "pjlr",
            "pjlf",
            "pjlg",
            "pjlc",
            "pjfs",
            "pfsr",
            "cvn",
        } or not law.get("signet"):
            continue
        identifier = "senat-" + str(law["loicod"])
        title = law.get("loiint") or law.get("loitit") or "Titre non renseigné"
        if protected(title):
            continue
        url = _url(source, str(law["signet"]))
        status = statuses.get(str(law["etaloicod"]), "Non renseigné")
        files.append((identifier, title, law["typloicod"], None, status, source.id, None, url))
        refs.append((identifier, source.id, law["loicod"], url, status, Path(path).name))
        laws[law["loicod"]] = (identifier, url)
        for key, label, at in (
            ("url_an", "Dossier Assemblée nationale", None),
            ("url_jo", "Publication au Journal officiel", law.get("loidatjo")),
            ("deccocurl", "Décision du Conseil constitutionnel", law.get("date_decision")),
        ):
            link = _safe_url(law.get(key))
            if link:
                events.append(
                    (
                        f"{identifier}-{key}",
                        identifier,
                        None,
                        "Autre institution",
                        label,
                        at,
                        temporal(at, today),
                        None,
                        len(events),
                        link,
                        source.id,
                    )
                )
        years = re.findall(r"\b(20\d{2})\b", title)
        if years and law["typloicod"] in {"pjlf", "pjfs", "pjlr", "pjlg", "pfsr"}:
            budgets.append(
                (
                    identifier,
                    int(years[-1]),
                    {
                        "pjfs": "PLFSS",
                        "pjlf": "PLF",
                        "pjlr": "Loi de finances rectificative",
                        "pjlg": "Loi de résultats",
                        "pfsr": "Financement rectificatif de la sécurité sociale",
                    }[str(law["typloicod"])],
                    "Sécurité sociale" if law["typloicod"] in {"pjfs", "pfsr"} else "État",
                    "Type DOSLEG et année du titre",
                )
            )
    readings = {row["lecidt"]: row for row in tables["lecture"] if row["loicod"] in laws}
    chambers = {row["lecassidt"]: row for row in tables["lecass"] if row["lecidt"] in readings}
    types = {row["typtxtcod"]: row.get("typtxtlib") for row in tables["typtxt"]}
    for row in tables["texte"]:
        if row["lecassidt"] not in chambers:
            continue
        chamber = chambers[row["lecassidt"]]
        reading = readings[chamber["lecidt"]]
        identifier, url = laws[reading["loicod"]]
        at = row.get("txtoritxtdat")
        label = " · ".join(
            str(x) for x in (reading.get("leccom"), types.get(row["typtxtcod"])) if x
        )
        link = _safe_url(row.get("texurl")) if row["typurl"] == "E" else None
        if link:
            documents.append(
                (
                    "senat-doc-" + str(row["texcod"]),
                    identifier,
                    "senat-texte-" + str(row["texcod"]),
                    types.get(row["typtxtcod"]) or "Texte parlementaire",
                    label or "Texte parlementaire",
                    link,
                    source.id,
                )
            )
        events.append(
            (
                "senat-texte-" + str(row["texcod"]),
                identifier,
                None,
                "Sénat" if chamber["codass"] == "S" else "Assemblée nationale",
                label or "Texte parlementaire",
                at,
                temporal(at, today),
                None,
                len(events),
                link or url,
                source.id,
            )
        )
    return {
        "legislative_files": files,
        "legislative_file_refs": refs,
        "legislative_events": events,
        "legislative_documents": documents,
        "budget_legislation": budgets,
    }


def administrative_rows(path: str, source: Source) -> dict[str, list[tuple[Any, ...]]]:
    if path.endswith(".zip"):
        with zipfile.ZipFile(path) as archive:
            name = next(n for n in archive.namelist() if n.endswith(".json"))
            payload = json.loads(archive.read(name))["service"]
    else:
        payload = json.loads(Path(path).read_text())
    rows, relations, pivots = [], [], []
    for service in payload:
        if (
            str(service.get("statut_de_diffusion")).lower() != "true"
            or service.get("version_type", "Publiable") != "Publiable"
        ):
            continue
        identifier = service["id"]
        name = service["nom"]
        if re.search(r"\b(?:Mme|Monsieur|Madame|M\.)\s", name):
            continue
        category = (
            "Ministère"
            if normalized(name).startswith("ministere ")
            else "Direction"
            if normalized(name).startswith("direction ")
            else "Service territorial"
            if source.id == "annuaire-etat"
            or service.get("type_organisme") == "Service déconcentré"
            else "Service central"
            if service.get("type_organisme") == "Administration centrale (ou Ministère)"
            else "Autre structure"
        )
        siren = str(service.get("siren") or "")
        rows.append(
            (
                identifier,
                name,
                service.get("sigle") or None,
                category,
                service.get("type_organisme"),
                siren if re.fullmatch(r"\d{9}", siren) else None,
                service.get("code_insee_commune") or None,
                _safe_url(service.get("url_service_public")),
                datetime.strptime(service["date_modification"], "%d/%m/%Y %H:%M:%S").isoformat()
                if service.get("date_modification")
                else None,
                source.id,
            )
        )
        for pivot in as_list(service.get("pivot")):
            for commune in as_list(pivot.get("code_insee_commune")):
                if isinstance(commune, str):
                    pivots.append((identifier, pivot.get("type_service_local"), commune))
        for link in as_list(service.get("hierarchie")):
            related = link.get("service")
            if isinstance(related, dict):
                related = related.get("id")
            relation = link.get("type_hierarchie") or ""
            if related and related != identifier:
                if "fils" in relation.lower():
                    relations.append((identifier, related, relation, source.id))
                elif "pere" in normalized(relation) or "parent" in normalized(relation):
                    relations.append((related, identifier, relation, source.id))
    return {
        "administrations": rows,
        "administration_relations": relations,
        "administration_pivots": pivots,
    }


def load(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    rows: dict[str, list[tuple[Any, ...]]] = {name: [] for name in TABLES}
    sources = {source.id: source for source in load_registry()}
    today = datetime.now(UTC).date()
    for source_id, loader in (
        ("jorfsimple", journals),
        ("dole", dole_files),
        ("an-dossiers", an_files),
        ("senat-dosleg", senate_files),
    ):
        result = loader(records[source_id].path, sources[source_id], today)
        for table, values in result.items():
            rows[table].extend(values)
    for source_id in ("roae", "annuaire-etat"):
        for table, values in administrative_rows(
            records[source_id].path, sources[source_id]
        ).items():
            rows[table].extend(values)
    for row in json.loads(Path(records["annuaire-competence"].path).read_text()):
        for identifier in as_list(row.get("id_service_local")):
            if isinstance(identifier, str):
                rows["administration_coverage"].append(
                    (
                        row["code_insee_commune"],
                        row["code_type_service_local"],
                        identifier,
                    )
                )
    con.execute(
        "create or replace table document_snapshot_dates (source_id varchar, data_date date)"
    )
    for source_id in (
        "an-dossiers",
        "senat-dosleg",
        "roae",
        "annuaire-etat",
        "annuaire-competence",
    ):
        record = records[source_id]
        snapshot = (
            parsedate_to_datetime(record.published_at).date()
            if record.published_at
            else date.fromisoformat(record.retrieved_at[:10])
        )
        con.execute("insert into document_snapshot_dates values (?, ?)", [source_id, snapshot])
    for table, columns in TABLES.items():
        con.execute(f"create or replace table {table}_raw ({columns})")
        if rows[table]:
            placeholders = ",".join("?" for _ in rows[table][0])
            con.executemany(
                f"insert into {table}_raw values ({placeholders})",
                [
                    tuple(
                        value.replace("\u2014", ",") if isinstance(value, str) else value
                        for value in row
                    )
                    for row in rows[table]
                ],
            )
