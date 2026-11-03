from pathlib import Path

import duckdb

from .registry import load_registry


def load(con: duckdb.DuckDBPyConnection, directory: str) -> None:
    source = next(source for source in load_registry() if source.id == "insee-apu-comptes")
    queries = [
        "select ? as filename, row_number() over () as line, * "
        "from read_xlsx(?, header = false, all_varchar = true, "
        "range = 'A1:CZ100', stop_at_empty = false)"
        for _ in source.files
    ]
    params = [value for name in source.files for value in (name, str(Path(directory) / name))]
    con.execute(
        "create or replace table public_account_cells as " + " union all ".join(queries), params
    )


def validate(con: duckdb.DuckDBPyConnection) -> None:
    mismatches = con.execute("""
        select f.sector, f.year, f.spending, a.amount, f.revenue, r.amount
        from public_finances f
        left join public_accounts a
            on a.sector = f.sector and a.year = f.year
            and a.block = 'depenses' and a.code = 'TOTAL'
        left join public_accounts r
            on r.sector = f.sector and r.year = f.year
            and r.block = 'recettes' and r.code = 'TOTAL'
        where f.sector <> 'S13' and (
            a.amount is null or r.amount is null
            or abs(f.spending - a.amount) > 5e7
            or abs(f.revenue - r.amount) > 5e7
        )
    """).fetchall()
    if mismatches:
        raise ValueError(f"INSEE detailed accounts disagree with table 3.215: {mismatches}")
