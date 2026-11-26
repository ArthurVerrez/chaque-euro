import csv
import io
import re
import shutil
import zipfile
from pathlib import Path

import duckdb

from .fetch import FetchRecord

ELECTIONS = (
    "municipales-2026-t1",
    "municipales-2026-t2",
    "europeennes-2024",
    "legislatives-2024-t1",
    "legislatives-2024-t2",
)
REI_RATES = {
    "rei-2021": ("REI_2021.xlsx", 2021),
    "rei-2022": ("REI_2022.xlsx", 2022),
    "rei-2023": ("REI_2023_V2.csv", 2023),
    "rei-2024": ("REI_2024.csv", 2024),
}
REI_RATE_COLUMNS = {
    "csv": ("DEP", "COM", "E12", "E22", "E32"),
    "xlsx": (
        "DEPARTEMENT",
        "COMMUNE",
        "FB - COMMUNE / TAUX NET",
        "FB - SYNDICATS ET ORG. ASSIMILES / TAUX NET",
        "FB - GFP / TAUX APPLICABLE SUR LE TERRITOIRE DE LA COMMUNE",
    ),
}


def _extract(archive: str, suffix: str) -> Path:
    path = Path(archive)
    with zipfile.ZipFile(path) as zipped:
        member = next(name for name in zipped.namelist() if name.endswith(suffix))
        destination = path.parent / Path(member).name
        with zipped.open(member) as source, destination.open("wb") as out:
            shutil.copyfileobj(source, out)
    return destination


def _load_rate_history(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    con.execute(
        "create or replace table rei_rate_history (year integer, dep varchar, com varchar, "
        "commune varchar, syndicate varchar, grouping varchar)"
    )
    for source_id, (member, year) in REI_RATES.items():
        path = str(_extract(records[source_id].path, member))
        if path.endswith(".csv"):
            relation = (
                "read_csv(?, delim = ';', header = true, all_varchar = true, encoding = 'latin-1')"
            )
            columns = REI_RATE_COLUMNS["csv"]
        else:
            relation = "read_xlsx(?, all_varchar = true)"
            described = con.execute(f"describe select * from {relation}", [path]).fetchall()
            names = {
                re.sub(r"_x([0-9A-F]{4})_", lambda m: chr(int(m.group(1), 16)), row[0]): row[0]
                for row in described
            }
            columns = tuple(names[label] for label in REI_RATE_COLUMNS["xlsx"])
        selected = ", ".join(f'"{column}"' for column in columns)
        con.execute(
            f"insert into rei_rate_history select {year}, {selected} from {relation}", [path]
        )


def _load_ipch(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    text = Path(records["insee-ipch"].path).read_text(encoding="utf-8")
    observations = re.findall(r'TIME_PERIOD="(\d{4}-\d{2})" OBS_VALUE="([\d.]+)"', text)
    con.execute("create or replace table ipch_raw (period varchar, value double)")
    con.executemany("insert into ipch_raw values (?, ?)", observations)


def load(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    archive = Path(records["rei-2025"].path)
    destination = archive.parent / "rei-2025-utf8.csv"
    with (
        zipfile.ZipFile(archive) as zipped,
        zipped.open("REI_2025.csv") as source,
        destination.open("w", encoding="utf-8") as out,
    ):
        shutil.copyfileobj(io.TextIOWrapper(source, encoding="cp1252"), out)
    con.execute("set variable rei_path = ?", [str(destination)])
    _load_rate_history(con, records)
    _load_ipch(con, records)
    workbook = _extract(records["ircom-2025"].path, "ircom_communes_complet_revenus_2024.xlsx")
    con.execute("set variable ircom_path = ?", [str(workbook)])
    con.execute(
        "create or replace table turnout_raw (source_id varchar, department_code varchar, "
        "insee varchar, registered bigint, voters bigint, abstentions bigint, "
        "published_rate double)"
    )
    con.execute(
        "create or replace table turnout_controls "
        "(source_id varchar, registered bigint, voters bigint)"
    )
    for source_id in ELECTIONS:
        directory = Path(records[source_id].path)
        with (directory / "communes.csv").open(encoding="utf-8-sig") as file:
            rows = csv.DictReader(file, delimiter=";")
            con.executemany(
                "insert into turnout_raw values (?, ?, ?, ?, ?, ?, ?)",
                [
                    (
                        source_id,
                        row["Code département"].zfill(2),
                        row["Code commune"].zfill(5),
                        int(row["Inscrits"].replace(" ", "")),
                        int(row["Votants"].replace(" ", "")),
                        int(row["Abstentions"].replace(" ", "")),
                        float(row["% Votants"].replace("%", "").replace(",", ".")),
                    )
                    for row in rows
                ],
            )
        national = directory / "national.csv"
        if national.exists():
            with national.open(encoding="utf-8-sig") as file:
                row = next(csv.DictReader(file, delimiter=";"))
            con.execute(
                "insert into turnout_controls values (?, ?, ?)",
                [source_id, int(row["Inscrits"]), int(row["Votants"])],
            )


def validate(con: duckdb.DuckDBPyConnection) -> None:
    checks = {
        "OFGL consolidation": """
            select count(*) from local_account_rows
            where abs(amount - (principal + annexes - internal_flows)) > 1
               or (population > 0 and abs(amount / population - source_per_capita) > 0.01)
        """,
        "OFGL spending sections": """
            select count(*) from local_accounts
            where abs(spending - operating - investment) > 1
        """,
        "OFGL duplicate account": """
            select count(*) from (
                select level, siren, year, item from local_account_rows
                group by all having count(*) > 1
            )
        """,
        "REI duplicate commune": """
            select count(*) from (select code from rei_rows group by all having count(*) > 1)
        """,
        "REI CFE zone bases": """
            select count(*) from rei_rows
            where abs(rei_number(P31) - rei_number(P31_1) - rei_number(P31_2)
                - rei_number(P31_3)) > 0.01
        """,
        "REI rate history": """
            select count(*) from (select year from commune_tax_rates group by year
                having count(*) < 30000)
        """,
        "IPCH November": """
            select count(*) from (select year from generate_series(2022, 2025) t(year))
            where year not in (select year from property_base_revaluation)
        """,
        "REI duplicate rate": """
            select count(*) from (select insee, year from commune_tax_rates
                group by all having count(*) > 1)
        """,
        "IRCOM duplicate total": """
            select count(*) from (select insee from commune_income group by all having count(*) > 1)
        """,
        "IRCOM taxable households": """
            select count(*) from commune_income where taxable_households > households
        """,
        "turnout arithmetic": """
            select count(*) from turnout_raw r join commune_turnout c using (source_id, insee)
            where c.excluded_communes = 0 and (r.voters > r.registered or r.voters < 0
              or r.voters + r.abstentions != r.registered
              or (r.registered > 0 and
                  abs(r.voters * 100.0 / r.registered - r.published_rate) > 0.011))
        """,
        "turnout invalid rows": """
            select count(*) from commune_turnout
            where excluded_communes > 0 and (turnout is not null or voters is not null
                or registered is not null)
        """,
        "turnout duplicate commune": """
            select count(*) from (
                select source_id, insee from turnout_raw group by all having count(*) > 1
            )
        """,
        "turnout national control": """
            select count(*) from turnout_controls c join (
                select source_id, sum(registered) registered, sum(voters) voters
                from turnout_raw group by all
            ) t using (source_id)
            where c.registered != t.registered or c.voters != t.voters
        """,
    }
    for name, query in checks.items():
        (failures,) = con.execute(query).fetchone() or (0,)
        if failures:
            raise ValueError(f"{name}: {failures} mismatches")
