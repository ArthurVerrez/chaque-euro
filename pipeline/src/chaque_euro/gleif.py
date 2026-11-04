import re
import shutil
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

import duckdb

from .fetch import FetchRecord
from .groups import pdf_text


def load(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    authorities = pdf_text(records["gleif-registration-authorities"].path)
    if not re.search(
        r"RA000189\s+France\s+FR\s+France\s+Register of Companies \(Sirene\)", authorities
    ):
        raise ValueError("GLEIF: Sirene registration authority not confirmed")
    if not re.search(r"RA000192\s+France\s+FR\s+France\s+Register of Commerce", authorities):
        raise ValueError("GLEIF: Infogreffe registration authority not confirmed")
    snapshots = []
    with tempfile.TemporaryDirectory(prefix="chaque-euro-gleif-") as directory:
        for source_id, table, cdf in (
            ("gleif-entities", "gleif_entity_input", "lei2"),
            ("gleif-relationships", "gleif_relationship_input", "rr"),
        ):
            with zipfile.ZipFile(records[source_id].path) as archive:
                names = archive.namelist()
                if len(names) != 1 or not re.fullmatch(
                    rf"\d{{8}}-\d{{4}}-gleif-goldencopy-{cdf}-golden-copy\.csv", names[0]
                ):
                    raise ValueError(f"{source_id}: unexpected Golden Copy archive")
                snapshots.append(names[0][:13])
                target = Path(directory) / f"{cdf}.csv"
                with archive.open(names[0]) as source, target.open("wb") as output:
                    shutil.copyfileobj(source, output)
            con.execute(f"set variable {table}_path = ?", [str(target)])
        if len(set(snapshots)) != 1:
            raise ValueError("GLEIF: Level 1 and Level 2 snapshots differ")
        con.execute(
            "set variable gleif_as_of = ?::date",
            [datetime.strptime(snapshots[0], "%Y%m%d-%H%M").date()],
        )
        con.execute((Path(__file__).resolve().parents[2] / "sql/inputs/gleif.sql").read_text())
