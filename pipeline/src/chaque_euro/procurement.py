import gzip
import json
import re
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import duckdb

from .fetch import FetchRecord


def _text(value: Any) -> str:
    return str(value.get("#text", "")) if isinstance(value, dict) else str(value or "")


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else [value] if value else []


def buyer_ids(data: dict[str, Any]) -> set[str]:
    ids = set()
    organism = data.get("FNSimple", {}).get("organisme", {})
    simple = organism.get("codeIdentificationNational")
    if simple and {"siret", "siren"}.intersection(organism.get("typeIdentificationNational", {})):
        ids.add(str(simple))
    for notice in data.get("EFORMS", {}).values():
        if not isinstance(notice, dict):
            continue
        buyers = {
            _text(p.get("cac:Party", {}).get("cac:PartyIdentification", {}).get("cbc:ID"))
            for p in _list(notice.get("cac:ContractingParty"))
        }
        extensions = notice.get("ext:UBLExtensions", {}).get("ext:UBLExtension", {})
        extension = extensions.get("ext:ExtensionContent", {}).get("efext:EformsExtension", {})
        for org in _list(extension.get("efac:Organizations", {}).get("efac:Organization")):
            company = org.get("efac:Company", {})
            identifier = _text(company.get("cac:PartyIdentification", {}).get("cbc:ID"))
            country = _text(
                company.get("cac:PostalAddress", {})
                .get("cac:Country", {})
                .get("cbc:IdentificationCode")
            )
            if identifier in buyers and country == "FRA":
                for entity in _list(company.get("cac:PartyLegalEntity")):
                    ids.add(_text(entity.get("cbc:CompanyID")))
    return {value[:9] for value in ids if re.fullmatch(r"\d{9}(?:\d{5})?", value)}


def estimate_range(data: dict[str, Any]) -> str | None:
    value = data.get("FNSimple", {}).get("initial", {}).get("natureMarche", {}).get("valeurEstimee")
    if not isinstance(value, dict) or not isinstance(value.get("fourchette"), dict):
        return None
    bounds = value["fourchette"]
    currency = value.get("@devise", "")
    if not re.fullmatch(r"[A-Z]{3}", currency):
        return None
    try:
        low = Decimal(bounds["valeurBasse"]) if bounds.get("valeurBasse") else None
        high = Decimal(bounds["valeurHaute"]) if bounds.get("valeurHaute") else None
    except InvalidOperation:
        return None
    if any(n is not None and (not n.is_finite() or n < 0) for n in (low, high)):
        return None
    if low is not None and high is not None:
        return f"{low} à {high} {currency} HT" if low <= high else None
    if low is not None:
        return f"Au moins {low} {currency} HT"
    if high is not None:
        return f"Jusqu\u2019à {high} {currency} HT"
    return None


def load(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    with Path(records["approch"].path).open("rb") as handle:
        compression = "gzip" if handle.read(2) == b"\x1f\x8b" else "uncompressed"
    con.execute("set variable approch_compression = ?", [compression])
    content = Path(records["boamp"].path).read_bytes()
    if content[:2] == b"\x1f\x8b":
        content = gzip.decompress(content)
    rows = json.loads(content)
    con.execute("""
        create table boamp_input (
            id varchar, subject varchar, published_on date, deadline timestamptz,
            procedure varchar, buyer_id varchar, estimated_range varchar
        )
    """)
    values = []
    for row in rows:
        data = json.loads(row["donnees"] or "{}")
        ids = buyer_ids(data)
        values.append(
            (
                row["idweb"],
                row["objet"],
                row["dateparution"],
                row["datelimitereponse"],
                row["procedure_libelle"],
                next(iter(ids)) if len(ids) == 1 else None,
                estimate_range(data),
            )
        )
    if values:
        con.executemany("insert into boamp_input values (?, ?, ?, ?, ?, ?, ?)", values)


def validate(con: duckdb.DuckDBPyConnection) -> None:
    for dimension in ("month", "department", "procedure", "type"):
        count, amount = con.execute(
            "select sum(count), sum(amount) from procurement_breakdown where dimension = ?",
            [dimension],
        ).fetchone() or (0, 0)
        expected = con.execute("select count(*), sum(amount) from procurement_base").fetchone()
        if not expected or count != expected[0] or abs(amount - expected[1]) > 1:
            raise ValueError(f"Procurement {dimension} totals do not reconcile")
    if con.execute("""
        select count(*) from sanction_input group by id_decision
        having min("Montant total") <> max("Montant total")
    """).fetchone():
        raise ValueError("Inconsistent sanction decision total")
    result = con.execute("""
        select count(*) from procurement_quality
        where on_time > valid or valid > eligible or eligible > total
    """).fetchone()
    if result and result[0]:
        raise ValueError("Invalid publication quality denominator")

    national = con.execute(
        "select total, known, single_bid from procurement_competition where dimension = 'national'"
    ).fetchone()
    for dimension in ("buyer", "sector"):
        totals = con.execute(
            "select sum(total), sum(known), sum(single_bid) from procurement_competition "
            "where dimension = ?",
            [dimension],
        ).fetchone()
        if totals != national:
            raise ValueError(f"Single-bid {dimension} totals do not reconcile")
    if con.execute(
        "select 1 from procurement_competition where single_bid > known or known > total "
        "or single_bid < 0 or known < 0 or total < 0"
    ).fetchone():
        raise ValueError("Invalid single-bid denominator")
