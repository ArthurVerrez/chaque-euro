import html
import re
import subprocess
import zipfile

import duckdb

from .fetch import FetchRecord

ROOT = "552049447"


def pdf_text(path: str) -> str:
    return subprocess.run(
        ["pdftotext", "-layout", path, "-"], check=True, capture_output=True, text=True
    ).stdout


def sncf_subsidiaries(text: str) -> list[str]:
    pages = [page for page in text.split("\f") if "N°SIREN" in page and "28. Filiales" in page]
    if len(pages) != 1:
        raise ValueError("SNCF 2025: expected one subsidiary table")
    section = (
        pages[0]
        .split("I. Renseignements concernant les filiales", 1)[1]
        .split("II. Renseignements concernant les participations", 1)[0]
    )
    subsidiaries = []
    for line in section.splitlines():
        match = re.match(r"\s*(\d{3}\s?\d{3}\s?\d{3})\s+", line)
        if not match:
            continue
        percentage = re.search(r"(\d+(?:[,.]\d+)?)\s*%", line)
        if percentage and float(percentage[1].replace(",", ".")) <= 50:
            continue
        subsidiaries.append(re.sub(r"\s", "", match[1]))
    if len(set(subsidiaries)) != 10 or not {"412280737", "519037584"} <= set(subsidiaries):
        raise ValueError("SNCF 2025: subsidiary table changed")
    return subsidiaries


def gares_identifier(text: str) -> str:
    match = re.search(
        r"SNCF Gares & Connexions, SA au capital social.*?"
        r"numéro\s+(\d{3}\s+\d{3}\s+\d{3})",
        re.sub(r"\s+", " ", text),
    )
    if not match or re.sub(r"\s", "", match[1]) != "507523801":
        raise ValueError("SNCF Gares & Connexions: official legal identifier missing")
    return re.sub(r"\s", "", match[1])


def load(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    sncf = pdf_text(records["sncf-groupe-2025"].path)
    if not re.search(r"552\s+049\s+447", sncf):
        raise ValueError("SNCF 2025: parent legal identifier missing")
    with zipfile.ZipFile(records["sncf-reseau-groupe-2025"].path) as archive:
        reports = [name for name in archive.namelist() if name.endswith(".xhtml")]
        if len(reports) != 1:
            raise ValueError("SNCF Réseau 2025: expected one XHTML report")
        report = archive.read(reports[0]).decode("utf-8")
    report = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", report)))
    if not re.search(
        r"Renseignements concernant les filiales \(\+ de 50 %.*?"
        r"SNCF Gares & Connexions [\d ]+100%",
        report,
    ):
        raise ValueError("SNCF Réseau 2025: Gares & Connexions control not confirmed")
    gares = gares_identifier(pdf_text(records["sncf-gares-identite"].path))
    con.execute("""
        create or replace table organisation_group_input (
            group_siren varchar, siren varchar, parent_siren varchar,
            source_id varchar, source_ref varchar, identifier_source_id varchar,
            identifier_ref varchar, as_of date
        )
    """)
    rows = [
        (ROOT, ROOT, None, "sncf-groupe-2025", "p. 320", "sncf-groupe-2025", "p. 320"),
        *[
            (ROOT, siren, ROOT, "sncf-groupe-2025", "p. 438", "sncf-groupe-2025", "p. 438")
            for siren in sncf_subsidiaries(sncf)
        ],
        (
            ROOT,
            gares,
            "412280737",
            "sncf-reseau-groupe-2025",
            "Comptes annuels, p. 279",
            "sncf-gares-identite",
            "p. 47 du PDF",
        ),
    ]
    con.executemany(
        "insert into organisation_group_input values (?, ?, ?, ?, ?, ?, ?, date '2025-12-31')",
        rows,
    )


def validate(con: duckdb.DuckDBPyConnection) -> None:
    count = con.execute(
        "select count(*) from org_group_members where group_siren = ?", [ROOT]
    ).fetchone()
    if count != (12,):
        raise ValueError("SNCF 2025: expected 12 public legal entities")
    duplicate = con.execute(
        "select siren from org_group_members group by siren having count(*) > 1 limit 1"
    ).fetchone()
    if duplicate:
        raise ValueError("Organisation assigned to more than one documented group")
