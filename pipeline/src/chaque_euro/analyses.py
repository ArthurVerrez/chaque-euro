import html
import re
import subprocess
from pathlib import Path

import duckdb

from . import lfi
from .fetch import FetchRecord


def _text(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", value))).strip()


def load(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    con.execute(
        "create or replace table eu_cells as "
        + " union all ".join(
            "select ?::integer as year, row_number() over () as line, * "
            "from read_xlsx(?, sheet = ?, header = false, all_varchar = true, "
            "range = 'A1:AL220', stop_at_empty = false)"
            for _ in range(2000, 2026)
        ),
        [v for year in range(2000, 2026) for v in (year, records["eu-budget"].path, str(year))],
    )
    pdf = subprocess.run(
        ["pdftotext", "-layout", records["crc-paris"].path, "-"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    con.execute("create or replace table paris_report as select ? as text", [pdf])
    pages = [
        page
        for page in pdf.split("\f")
        if "Données métropolitaines" in page
        and "Comparaisons entre Paris, Lyon et Marseille (données 2023)" in page
    ]
    if len(pages) != 1:
        raise ValueError("CRC Paris: expected one 2023 comparison annex")
    con.execute("create or replace table paris_annex as select ? as text", pages)
    con.execute(
        "create or replace table france_population as "
        "select A::integer as year, B::double * 1000 as population "
        "from read_xlsx(?, header = false, all_varchar = true, range = 'A5:C40') "
        "where try_cast(A as integer) between 2000 and 2026",
        [records["france-population"].path],
    )
    costs = subprocess.run(
        ["pdftotext", "-layout", records["student-cost"].path, "-"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    con.execute("create or replace table student_cost_page as select ? as text", [_text(costs)])
    appropriations: set[tuple[int, str, str, int]] = set()
    names = {"Vie étudiante": "231", "Formations supérieures et recherche universitaire": "150"}
    for source_id, year, stage in [("lfi-2026", 2026, "voted"), ("plf-2027", 2027, "proposed")]:
        for table in re.findall(
            r"<table\b.*?</table>", Path(records[source_id].path).read_text(), re.S
        ):
            candidates = []
            for row in lfi.ROW.findall(table):
                cells = [_text(cell) for cell in lfi.CELL.findall(row)]
                if len(cells) == 3 and cells[0] in names:
                    candidates.append(
                        (year, stage, names[cells[0]], int(cells[2].replace(" ", "")))
                    )
            if {entry[2] for entry in candidates} == set(names.values()):
                appropriations.update(candidates)
                break
    if len(appropriations) != 4:
        raise ValueError("Student appropriations: missing or inconsistent programme totals")
    con.execute(
        "create or replace table student_appropriations "
        "(year integer, stage varchar, programme varchar, amount double)"
    )
    con.executemany("insert into student_appropriations values (?, ?, ?, ?)", list(appropriations))
    funds: list[int] = []
    for row in lfi.ROW.findall(Path(records["rail-dividend"].path).read_text()):
        cells = [_text(cell) for cell in lfi.CELL.findall(row)]
        if len(cells) == 7 and cells[0] == "SNCF":
            funds.append(int(cells[4].replace(" ", "")) * 1_000_000)
    if len(funds) != 1:
        raise ValueError("SNCF fund: expected one 2025 executed CP observation")
    con.execute("create or replace table sncf_fund as select ?::double as amount", funds)


def validate(con: duckdb.DuckDBPyConnection) -> None:
    checks = {
        "deficit against 3.215": """
            select count(*) from deficit_series d join public_finances f using (year)
            where (f.sector = 'S13' and abs(d.apu_balance - (f.revenue - f.spending)
                  - case when d.year = 2024 then 119100000 else 0 end) > 1e6)
               or (f.sector = 'S13111' and abs(d.state_balance - (f.revenue - f.spending)) > 5e7)
        """,
        "EU headings against published expenditure": """
            select count(*) from eu_flows f join
              (select year, sum(amount) as amount from eu_headings group by year) h using (year)
            where abs(f.expenditure - h.amount) > 1
        """,
        "EU contribution against French executed revenue": """
            select count(*) from eu_flows
            where year = 2025 and abs(contribution - customs
                + (select amount from revenue where section_code = '32')) > 1
        """,
        "EU population coverage": "select count(*) from eu_flows where population is null",
        "network investment reconciliation": """
            select count(*) from rail_network where abs(eu + state + local_other - total) > 2e5
        """,
        "rail revenue reconciliation": """
            select count(*) from rail_revenue
            where abs(commercial + public - total) > 1
        """,
        "rail transfer reconciliation": """
            select count(*) from rail_transfers
            where abs(operating + investment - total) > 2e6
        """,
        "scholarship echelon reconciliation": """
            select abs((select recipients from student_scholarships where year = 2025)
                - (select sum(recipients) from scholarship_echelons))
        """,
        "Paris published ratios": """
            select count(*) from paris_comparison
            where abs(spending / population - per_capita) > 1
        """,
    }
    for label, query in checks.items():
        result = con.execute(query).fetchone()
        if result is None or result[0] != 0:
            raise ValueError(f"Analysis reconciliation failed: {label}: {result}")
    for table, expected in {
        "deficit_series": 77,
        "eu_flows": 26,
        "eu_headings": 45,
        "paris_comparison": 3,
        "rail_transfers": 19,
        "rail_network": 24,
        "rail_revenue": 20,
        "student_scholarships": 14,
        "student_budget": 6,
    }.items():
        result = con.execute(f"select count(*) from {table}").fetchone()
        if result != (expected,):
            raise ValueError(f"Analysis coverage changed: {table}: {result}, expected {expected}")
    for table in ["paris_context", "rail_context", "student_cost"]:
        if con.execute(f"select count(*) from {table} where amount is null").fetchone() != (0,):
            raise ValueError(f"Analysis reference extraction failed: {table}")
