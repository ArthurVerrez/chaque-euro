import gzip
import json
import math
from itertools import pairwise
from typing import Any

import duckdb

type Point = tuple[float, float]
type Ring = list[Point]

METRO_LATITUDE = 46.5
METRO_ORIGIN = (-5.5, 51.5)
OVERSEAS = ("971", "972", "973", "974", "976")
NATIONAL_SCALE = 200
LOCAL_SCALE = 1000
INSET = {"left": 20, "top": 960, "size": 180, "gap": 16}
EPSILON = {"national": 2.0, "outline": 8.0, "commune": 2.5}


def _features(path: str) -> list[dict[str, Any]]:
    with gzip.open(path, "rt", encoding="utf-8") as file:
        features: list[dict[str, Any]] = json.load(file)["features"]
    return features


def _rings(geometry: dict[str, Any]) -> list[list[list[float]]]:
    polygons = (
        [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    )
    return [ring for polygon in polygons for ring in polygon]


def _simplify(ring: Ring, epsilon: float) -> Ring:
    keep = [False] * len(ring)
    keep[0] = keep[-1] = True
    stack = [(0, len(ring) - 1)]
    while stack:
        start, end = stack.pop()
        (x1, y1), (x2, y2) = ring[start], ring[end]
        dx, dy = x2 - x1, y2 - y1
        length = math.hypot(dx, dy)
        farthest, index = 0.0, -1
        for i in range(start + 1, end):
            x, y = ring[i]
            distance = (
                abs(dy * (x - x1) - dx * (y - y1)) / length
                if length
                else math.hypot(x - x1, y - y1)
            )
            if distance > farthest:
                farthest, index = distance, i
        if index > 0 and farthest > epsilon:
            keep[index] = True
            stack += [(start, index), (index, end)]
    return [point for point, kept in zip(ring, keep, strict=True) if kept]


def _path(rings: list[Ring], epsilon: float) -> str:
    parts = []
    for ring in rings:
        points: list[tuple[int, int]] = []
        for x, y in _simplify(ring, epsilon):
            point = (round(x), round(y))
            if not points or point != points[-1]:
                points.append(point)
        if len(points) < 4:
            continue
        (x0, y0), moves = (
            points[0],
            " ".join(f"{x - px} {y - py}" for (px, py), (x, y) in pairwise(points[:-1])),
        )
        parts.append(f"M{x0} {y0}l{moves}z")
    return "".join(parts) or (_path(rings, 0) if epsilon else "")


def _area(ring: Ring) -> float:
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in pairwise(ring)) / 2


def _centre(rings: list[Ring]) -> Point:
    ring = max(rings, key=lambda candidate: abs(_area(candidate)))
    area = _area(ring)
    if not area:
        return ring[0]
    cx = sum((x1 + x2) * (x1 * y2 - x2 * y1) for (x1, y1), (x2, y2) in pairwise(ring))
    cy = sum((y1 + y2) * (x1 * y2 - x2 * y1) for (x1, y1), (x2, y2) in pairwise(ring))
    return cx / (6 * area), cy / (6 * area)


def _bounds(rings: list[Ring]) -> tuple[float, float, float, float]:
    xs = [x for ring in rings for x, _ in ring]
    ys = [y for ring in rings for _, y in ring]
    return min(xs), min(ys), max(xs), max(ys)


def _viewbox(bounds: tuple[float, float, float, float], margin: float) -> str:
    x0, y0, x1, y1 = bounds
    pad = max(x1 - x0, y1 - y0) * margin
    return (
        f"{round(x0 - pad)} {round(y0 - pad)} {round(x1 - x0 + 2 * pad)} {round(y1 - y0 + 2 * pad)}"
    )


def _local(rings: list[list[list[float]]], latitude: float) -> list[Ring]:
    factor = math.cos(math.radians(latitude)) * LOCAL_SCALE
    return [[(lon * factor, -lat * LOCAL_SCALE) for lon, lat in ring] for ring in rings]


def _metro(rings: list[list[list[float]]]) -> list[Ring]:
    factor = math.cos(math.radians(METRO_LATITUDE)) * NATIONAL_SCALE
    lon0, lat0 = METRO_ORIGIN
    return [
        [((lon - lon0) * factor, (lat0 - lat) * NATIONAL_SCALE) for lon, lat in ring]
        for ring in rings
    ]


def _inset(rings: list[Ring], slot: int) -> list[Ring]:
    x0, y0, x1, y1 = _bounds(rings)
    scale = INSET["size"] / max(x1 - x0, y1 - y0)
    left = INSET["left"] + (INSET["size"] - (x1 - x0) * scale) / 2
    top = INSET["top"] + slot * (INSET["size"] + INSET["gap"])
    return [[(left + (x - x0) * scale, top + (y - y0) * scale) for x, y in ring] for ring in rings]


def load(con: duckdb.DuckDBPyConnection, departements: str, communes: str) -> str:
    latitudes: dict[str, float] = {}
    national_rings: list[Ring] = []
    rows = []
    for feature in _features(departements):
        code = feature["properties"]["code"]
        if len(code) > 2 and code not in OVERSEAS:
            continue
        raw = _rings(feature["geometry"])
        overseas = code in OVERSEAS
        latitude = (
            sum(lat for ring in raw for _, lat in ring) / sum(len(ring) for ring in raw)
            if overseas
            else METRO_LATITUDE
        )
        latitudes[code] = latitude
        local = _local(raw, latitude)
        national = _inset(local, OVERSEAS.index(code)) if overseas else _metro(raw)
        national_rings += national
        label_x, label_y = _centre(national)
        rows.append(
            (
                code,
                _path(national, EPSILON["national"]),
                _path(local, EPSILON["outline"]),
                _viewbox(_bounds(local), 0.04),
                round(label_x),
                round(label_y),
                round(math.sqrt(max(abs(_area(ring)) for ring in national))),
            )
        )
    con.execute(
        "create or replace table geo_departements (code varchar, path varchar, outline varchar,"
        " viewbox varchar, label_x integer, label_y integer, label_size integer)"
    )
    con.executemany("insert into geo_departements values (?, ?, ?, ?, ?, ?, ?)", rows)

    shapes = []
    for feature in _features(communes):
        properties = feature["properties"]
        if "commune" in properties or properties["departement"] not in latitudes:
            continue
        local = _local(_rings(feature["geometry"]), latitudes[properties["departement"]])
        cx, cy = _centre(local)
        shapes.append((properties["code"], _path(local, EPSILON["commune"]), round(cx), round(cy)))
    con.execute(
        "create or replace table geo_communes (insee varchar, path varchar, cx integer, cy integer)"
    )
    con.executemany("insert into geo_communes values (?, ?, ?, ?)", shapes)
    return _viewbox(_bounds(national_rings), 0.01)
