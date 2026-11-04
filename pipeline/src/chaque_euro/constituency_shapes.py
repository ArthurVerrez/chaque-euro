import gzip
import json
import tempfile
import zipfile
from pathlib import Path

import duckdb

from .fetch import FetchRecord


def load(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    con.execute("install spatial; load spatial")
    with (
        tempfile.TemporaryDirectory() as directory,
        zipfile.ZipFile(records["insee-constituency-contours"].path) as archive,
    ):
        for extension in ("shp", "shx", "dbf", "prj", "cpg"):
            name = f"circonscriptions_legislatives_030522.{extension}"
            (Path(directory) / name).write_bytes(archive.read(name))
        con.execute(
            "create or replace table constituency_shapes_raw as "
            "select dep as department_code, right(id_circo, 2)::integer as constituency, geom "
            "from ST_Read(?)",
            [str(Path(directory) / "circonscriptions_legislatives_030522.shp")],
        )
    with gzip.open(records["contours-communes"].path, "rt", encoding="utf-8") as file:
        features = json.load(file)["features"]
    con.execute("create or replace table commune_geometries_raw(insee varchar, geometry varchar)")
    con.executemany(
        "insert into commune_geometries_raw values (?, ?)",
        [
            (feature["properties"]["code"], json.dumps(feature["geometry"]))
            for feature in features
            if "commune" not in feature["properties"]
        ],
    )
