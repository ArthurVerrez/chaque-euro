import json
import unittest
from pathlib import Path

import duckdb

SQL = Path(__file__).parents[1] / "sql" / "59_constituency_shapes.sql"


class ConstituencyShapesTest(unittest.TestCase):
    def test_only_split_communes_receive_clipped_polygons_with_holes(self) -> None:
        with duckdb.connect() as con:
            con.execute("install spatial; load spatial")
            con.execute(
                "create table commune_constituencies "
                "(insee varchar, department_code varchar, constituency integer)"
            )
            con.execute(
                "insert into commune_constituencies values "
                "('75056','75',1),('75056','75',2),('01001','01',1)"
            )
            con.execute(
                "create table commune_geometries_raw as select '75056' as insee, "
                "ST_AsGeoJSON(ST_MakeEnvelope(2,48,2.1,48.1)) as geometry "
                "union all select '01001',ST_AsGeoJSON(ST_MakeEnvelope(1,47,1.1,47.1))"
            )
            con.execute(
                "create table constituency_shapes_raw as select '75' as department_code, "
                "1 as constituency, ST_GeomFromText('POLYGON "
                "((1 47,3 47,3 49,1 49,1 47),"
                "(2.04 48.04,2.04 48.06,2.06 48.06,2.06 48.04,2.04 48.04))') as geom "
                "union all select '75',2,ST_GeomFromText('MULTIPOLYGON "
                "(((2.07 48.01,2.09 48.01,2.09 48.03,2.07 48.03,2.07 48.01)),"
                "((2.07 48.07,2.09 48.07,2.09 48.09,2.07 48.09,2.07 48.07)))') "
                "union all select '01',1,ST_MakeEnvelope(0,46,2,48)"
            )
            con.execute(SQL.read_text())
            self.assertEqual(
                con.execute(
                    "select insee,constituency,source_id from constituency_shapes order by all"
                ).fetchall(),
                [("75056", i, "insee-constituency-contours") for i in (1, 2)],
            )
            rows = con.execute(
                "select constituency,geometry from constituency_shapes order by constituency"
            ).fetchall()
            self.assertEqual(len(json.loads(rows[0][1])["coordinates"]), 2)
            self.assertEqual(json.loads(rows[1][1])["type"], "MultiPolygon")
            self.assertEqual(len(json.loads(rows[1][1])["coordinates"]), 2)
            self.assertEqual(
                con.execute(
                    "select ST_XMin(ST_GeomFromGeoJSON(geometry)),"
                    "ST_XMax(ST_GeomFromGeoJSON(geometry)) from constituency_shapes "
                    "where constituency=1"
                ).fetchone(),
                (1.99, 2.11),
            )


if __name__ == "__main__":
    unittest.main()
