import html
import re

import duckdb

ROW = re.compile(r"<tr\b.*?</tr>", re.S)
CELL = re.compile(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", re.S)
BOLD = re.compile(r"GRAS|font-weight:\s*bold")


def _text(cell: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", cell))).strip()


def _amount(text: str) -> int:
    return int(re.sub(r"\D", "", text))


def load(con: duckdb.DuckDBPyConnection, path: str) -> None:
    with open(path, encoding="utf-8") as file:
        page = file.read()
    start = page.index("<table", page.index("DES CRÉDITS DU BUDGET GÉNÉRAL"))
    table = page[start : page.index("</table>", start)]
    missions: list[tuple[str, int]] = []
    total = 0
    for row in ROW.findall(table):
        cells = CELL.findall(row)
        if len(cells) != 3 or not BOLD.search(cells[0]):
            continue
        name, payments = _text(cells[0]), _text(cells[2])
        if not payments[:1].isdigit():
            continue
        if name == "Total":
            total = _amount(payments)
        else:
            missions.append((name.replace("\u2019", "'"), _amount(payments)))
    if not missions or sum(amount for _, amount in missions) != total:
        raise ValueError("LFI 2026 état B: missions do not add up to the published total")
    con.execute("create or replace table lfi_missions (mission varchar, voted double)")
    con.executemany("insert into lfi_missions values (?, ?)", missions)
