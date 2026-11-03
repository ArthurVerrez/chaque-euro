import csv
import gzip
import io
import json
from pathlib import Path
from typing import Any

import duckdb

from .fetch import FetchRecord


def _bytes(path: str) -> bytes:
    content = Path(path).read_bytes()
    return gzip.decompress(content) if content.startswith(b"\x1f\x8b") else content


def _csv(con: duckdb.DuckDBPyConnection, table: str, path: str) -> None:
    content = _bytes(path)
    encoding = "utf-16" if content.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig"
    rows = csv.reader(io.StringIO(content.decode(encoding)), delimiter=";")
    columns = next(rows)
    names = ", ".join('"' + name.replace('"', '""') + '" varchar' for name in columns)
    con.execute(f"create or replace table {table} ({names})")
    con.executemany(f"insert into {table} values ({', '.join('?' for _ in columns)})", rows)


def load(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    for table, source in (
        ("monthly_raw", "state-monthly"),
        ("titles_raw", "state-titles"),
        ("assets_raw", "state-assets"),
        ("green_raw", "green-budget"),
    ):
        _csv(con, table, records[source].path)
    con.execute(
        "create or replace table ministry_raw as select * from read_xlsx(?, "
        "header=true, all_varchar=true)",
        [records["state-ministries"].path],
    )
    con.execute(
        "create or replace table national_cells "
        "(dataset varchar, line integer, col integer, value varchar)"
    )
    for dataset, path, sheet, cell_range in (
        (
            "beneficiaries",
            str(Path(records["insee-levies"].path) / "beneficiaries.xlsx"),
            "T_3216",
            "A1:CR40",
        ),
        ("taxes", str(Path(records["insee-levies"].path) / "taxes.xlsx"), "T_3217", "A1:AG115"),
        ("protection", records["drees-protection"].path, "prestations_1959_2024", "A1:BO265"),
    ):
        rows = con.execute(
            "select * from read_xlsx(?, sheet=?, header=false, all_varchar=true, "
            "range=?, stop_at_empty=false)",
            [path, sheet, cell_range],
        ).fetchall()
        con.executemany(
            "insert into national_cells values (?, ?, ?, ?)",
            [
                (dataset, line, col, value)
                for line, row in enumerate(rows, 1)
                for col, value in enumerate(row)
                if value is not None
            ],
        )
    con.execute(
        "create or replace table eurostat_raw "
        "(dataset varchar, geo varchar, period varchar, unit varchar, "
        "item varchar, function varchar, amount double, status varchar)"
    )
    directory = Path(records["eurostat-finances"].path)
    for name in ("main", "edp", "functions", "quarterly"):
        payload: dict[str, Any] = json.loads(_bytes(str(directory / f"{name}.json")))
        if payload.get("class") != "dataset":
            raise ValueError(f"Eurostat {name}: not a JSON-stat dataset")
        dimensions = payload["id"]
        categories = [
            dict(
                (position, code)
                for code, position in payload["dimension"][dim]["category"]["index"].items()
            )
            for dim in dimensions
        ]
        values = payload["value"]
        observations = values.items() if isinstance(values, dict) else enumerate(values)
        rows = []
        for position, amount in observations:
            if amount is None:
                continue
            offset = int(position)
            codes = {}
            for dim, size, category in reversed(
                list(zip(dimensions, payload["size"], categories, strict=True))
            ):
                codes[dim] = category[offset % size]
                offset //= size
            status = payload.get("status", {})
            flag = status.get(str(position), "") if isinstance(status, dict) else ""
            rows.append(
                (
                    name,
                    codes["geo"],
                    codes["time"],
                    codes["unit"],
                    codes["na_item"],
                    codes.get("cofog99", ""),
                    amount,
                    flag,
                )
            )
        con.executemany("insert into eurostat_raw values (?, ?, ?, ?, ?, ?, ?, ?)", rows)


def validate(con: duckdb.DuckDBPyConnection) -> None:
    checks = {
        "monthly balance": """select year, month from state_monthly
            where abs(revenue + funds - spending - transfers + special + annex - balance) > 1""",
        "monthly components": """select year, month from monthly_totals
            where abs(spending - spending_parts) > 1 or abs(revenue - revenue_parts) > 1""",
        "titles versus programmes": """select coalesce(t.programme_code, b.programme_code)
            from title_programmes t full join budget b using (programme_code)
            where b.spent is null or abs(coalesce(t.amount, 0) - b.spent) > 1""",
        "ministry mapping": """select programme_code from title_programmes t
            left join ministry_codes m using (programme_code) where m.ministry is null""",
        "ministry totals": """select m.year from state_ministries m group by m.year
            having abs(sum(m.amount) - (select sum(t.amount) from state_titles t
            where t.year=m.year)) > 1""",
        "balance sheet": """select year from state_assets
            where abs(assets - liabilities - net_position) > 1
            or abs(net_position + net_accounts + charges - products) > 1""",
        "levies beneficiaries": """select year from compulsory_levies where block='beneficiary'
            group by year having abs(sum(case when code='TOTAL' then -amount
            when code in ('S1311','S1313','S1314','S212') then amount
            else 0 end)) > 1e6""",
        "levies central split": """select year from compulsory_levies
            where block='beneficiary' and code in ('S1311','S13111','S13112')
            group by year having count(*)=3 and abs(sum(case when code='S1311'
            then -amount else amount end)) > 1e6""",
        "levies tables": """select a.year from compulsory_levies a
            join compulsory_levies b on a.year=b.year and b.block='tax' and b.code='TOTAL'
            where a.block='beneficiary' and a.code='TOTAL' and abs(a.amount-b.amount)>1e6""",
        "social benefits": """select year from social_benefits group by year
            having abs(sum(case when risk='TOTAL' then -amount else amount end)) > 1e5""",
        "European balance": """select geo, year from european_finances
            where abs(revenue - spending - balance) > 0.21""",
        "European functions": """select f.geo, f.year from european_functions f
            join european_finances a using (geo,year) group by f.geo,f.year,a.spending
            having count(*)<>10 or abs(sum(f.spending)-a.spending)>0.61""",
    }
    for label, query in checks.items():
        if mismatches := con.execute(query).fetchall():
            raise ValueError(f"National accounts cross-check failed ({label}): {mismatches}")
    for table in (
        "state_monthly",
        "state_titles",
        "state_ministries",
        "state_assets",
        "compulsory_levies",
        "social_benefits",
        "green_budget",
        "european_finances",
        "european_functions",
        "quarterly_debt",
    ):
        if con.execute(f"select count(*) from {table}").fetchone() == (0,):
            raise ValueError(f"Empty national dataset: {table}")
