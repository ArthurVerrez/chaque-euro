import zipfile
from pathlib import Path

import duckdb

from .fetch import FetchRecord
from .public_roles import archive_json, many


def load(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    con.execute(
        "set variable constituency_path = ?", [records["commune-circonscriptions-2024"].path]
    )
    archive = Path(records["insee-passage-2025"].path)
    destination = archive.parent / "passage.xlsx"
    with zipfile.ZipFile(archive) as zipped:
        destination.write_bytes(zipped.read("table_passage_annuelle_2025.xlsx"))
    con.execute("set variable commune_passage_path = ?", [str(destination)])
    con.execute(
        "set variable commune_functions_path = ?",
        [[records[f"dgfip-fonctions-{year}"].path for year in (2024, 2025)]],
    )
    con.execute(
        "create or replace table mandate_constituencies_raw "
        "(mandate_id varchar, department_code varchar, constituency integer)"
    )
    rows = {}
    for source in ("an-history", "an-members"):
        for actor in archive_json(records[source].path, "acteur"):
            for mandate in many((actor.get("mandats") or {}).get("mandat")):
                if mandate["typeOrgane"] != "ASSEMBLEE" or str(mandate.get("legislature")) != "17":
                    continue
                place = (mandate.get("election") or {}).get("lieu") or {}
                if place.get("numCirco") and place.get("numDepartement"):
                    rows[mandate["uid"]] = (
                        mandate["uid"],
                        place["numDepartement"],
                        int(place["numCirco"]),
                    )
    con.executemany("insert into mandate_constituencies_raw values (?, ?, ?)", rows.values())


def validate(con: duckdb.DuckDBPyConnection) -> None:
    for insee, expected in (("69123", 4), ("75056", 18), ("33063", 3), ("01001", 1)):
        count = con.execute(
            "select count(*) from commune_constituencies where insee = ?", [insee]
        ).fetchone()
        if count != (expected,):
            raise ValueError(f"Constituency mapping changed for {insee}: {count}")
    if con.execute(
        "select count(*) from commune_functions where amount is null or not isfinite(amount)"
    ).fetchone() != (0,):
        raise ValueError("Invalid communal functional amounts")
