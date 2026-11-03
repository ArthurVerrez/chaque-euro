import re
import subprocess

import duckdb

from .fetch import FetchRecord
from .national import _csv

BRANCHES = {
    "Maladie": "maladie",
    "AT/MP": "atmp",
    "Vieillesse": "vieillesse",
    "Famille": "famille",
    "Autonomie": "autonomie",
    "ROBSS": "total",
    "FSV": "fsv",
    "ROBSS+FSV": "total_fsv",
}


def ccss_rows(text: str) -> list[tuple[int, str, str, float]]:
    sections = re.findall(
        r"Tableau 16 ● Charges nettes, produits nets et soldes.*?Source : DSS/SDEPF/6A", text, re.S
    )
    if len(sections) != 1:
        raise ValueError("CCSS: expected one branch table 16")
    if not re.search(r"2022\s+2023\s+2024\s+2025\s+2026 \(p \)\s+2027 \(p \)", sections[0]):
        raise ValueError("CCSS: unexpected years in branch table")
    rows: list[tuple[int, str, str, float]] = []
    branch = ""
    for line in sections[0].splitlines():
        cells = re.split(r"\s{2,}", line.strip())
        label = re.sub(r"\s", "", cells[0])
        if label in BRANCHES:
            branch = BRANCHES[label]
        elif label in ("Recettes", "Dépenses", "Solde"):
            values = cells[1:]
            expected = 4 if branch == "fsv" else 6
            if not branch or len(values) != expected:
                raise ValueError(f"CCSS: invalid {branch} {label}: {values}")
            rows.extend(
                (2022 + col, branch, label, float(value.replace(" ", "")))
                for col, value in enumerate(values)
            )
    if len(rows) != 138:
        raise ValueError(f"CCSS: incomplete branch table ({len(rows)} cells)")
    return rows


def plfss_rows(text: str) -> list[tuple[str, str, float]]:
    sections = re.findall(
        r"Tableau 6 ● Charges et produits nets.*?Source : Direction de la Sécurité sociale",
        text,
        re.S,
    )
    if len(sections) != 1:
        raise ValueError("PLFSS 2027: expected one branch table 6")
    rows: list[tuple[str, str, float]] = []
    metrics = {"CHARGESNETTES": "Dépenses", "PRODUITSNETS": "Recettes", "RESULTATNET": "Solde"}
    for line in sections[0].splitlines():
        cells = re.split(r"\s{2,}", line.strip())
        metric = metrics.get(re.sub(r"\s", "", cells[0]))
        if metric:
            if len(cells) != 7:
                raise ValueError(f"PLFSS 2027: invalid {metric}: {cells}")
            rows.extend(
                (branch, metric, float(re.sub(r"\s", "", value).replace(",", ".")) * 1000)
                for branch, value in zip(
                    ("maladie", "vieillesse", "famille", "atmp", "autonomie", "total"),
                    cells[1:],
                    strict=True,
                )
            )
    if len(rows) != 18:
        raise ValueError("PLFSS 2027: incomplete branch table")
    return rows


def load(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> None:
    con.execute(
        "create or replace table social_pdf (source_id varchar, year integer, "
        "branch varchar, metric varchar, amount double)"
    )
    for source_id in ("ccss-octobre-2026", "dss-branches-2027"):
        text = subprocess.run(
            ["pdftotext", "-layout", records[source_id].path, "-"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
        if source_id == "ccss-octobre-2026":
            rows = [(source_id, *row) for row in ccss_rows(text)]
        else:
            rows = [(source_id, 2027, *row) for row in plfss_rows(text)]
        con.executemany("insert into social_pdf values (?, ?, ?, ?, ?)", rows)
    con.execute(
        "create or replace table social_cells "
        "(dataset varchar, line integer, col integer, value varchar)"
    )
    for dataset, source, sheet in (
        ("branches", "dss-branches-2026", "II.tab5"),
        ("ondam2024", "dss-ondam-2026", "I.2_Tableau 1"),
        ("ondam2025", "dss-ondam-2026", "I.3_Tableau 3"),
        ("ondam2026", "dss-ondam-2026", "I.5_Tableau 8"),
    ):
        cells = con.execute(
            "select * from read_xlsx(?, sheet=?, header=false, all_varchar=true, "
            "range='A1:L42', stop_at_empty=false)",
            [records[source].path, sheet],
        ).fetchall()
        con.executemany(
            "insert into social_cells values (?, ?, ?, ?)",
            [
                (dataset, line, col, value)
                for line, row in enumerate(cells, 1)
                for col, value in enumerate(row)
                if value is not None
            ],
        )
    for table, source in (
        ("health_raw", "drees-sante-financeurs"),
        ("family_raw", "cnaf-depenses"),
        ("unemployment_raw", "unedic-finances"),
    ):
        _csv(con, table, records[source].path)
    con.execute(
        "create or replace table pensions_raw as "
        "select * from read_xlsx(?, sheet='A-Cadrage', all_varchar=true)",
        [records["drees-retraites"].path],
    )


def validate(con: duckdb.DuckDBPyConnection) -> None:
    checks = {
        "branch identity": """select source_id, year, branch from social_branches
            where revenue is null or spending is null or balance is null
            or abs(revenue-spending-balance)>case when source_id='dss-branches-2027'
            then 1.01e8 else 1.01e6 end""",
        "branch balances versus published total": """select source_id, year
            from social_branches where branch not in ('fsv','total_fsv')
            group by source_id, year having count(*)<>6 or
            abs(sum(case when branch='total' then -balance else balance end))>
            case when source_id='dss-branches-2027' then 3e8 else 3e6 end""",
        "FSV balance": """select a.year from social_branches a
            join social_branches b using (source_id,year)
            join social_branches c using (source_id,year)
            where a.branch='total' and b.branch='fsv' and c.branch='total_fsv'
            and abs(a.balance+b.balance-c.balance)>1.01e6""",
        "health payers": """select year from health_payers group by year
            having count(*)<>6 or abs(sum(case when code='f000' then -amount
            else amount end))>1e4""",
        "ONDAM": """select year from social_ondam group by year having count(*)<>7 or
            abs(sum(case when code='total' then -amount else amount end))>3.51e8""",
        "family territorial total": """select annee,prestations from family_raw
            where try_cast(dep_ts_regimes_metro as double) is not null
            and abs(dep_ts_regimes::double-dep_ts_regimes_metro::double
            -dep_ts_regimes_dom::double)>0.01""",
        "unemployment balance": """select year from unemployment_accounts
            where abs(revenue-spending-balance)>1.01e6 or
            abs(balance+exceptional-financial_balance)>1.01e6""",
        "unemployment components": """select annee from unemployment_raw where
            abs(recettes_total::double-recettes_contributions_principales::double
            -coalesce(try_cast(recettes_csg as double),0)-recettes_autres::double)>2
            or abs(depenses_total::double-depenses_allocations_brutes_et_aides::double
            -depenses_retraites::double-depenses_activite_partielle::double
            -depenses_financement_pole_emploi_france_travail_et_frais_de_recouvrement::double
            -depenses_autres::double)>2""",
        "pension population": """select year from pension_indicators group by year
            having count(*)<>3 or abs(sum(case when sex='Ensemble' then -recipients
            else recipients end))>1""",
    }
    for label, query in checks.items():
        if mismatches := con.execute(query).fetchall():
            raise ValueError(f"Social accounts cross-check failed ({label}): {mismatches}")
    for table in (
        "social_branches",
        "social_ondam",
        "health_payers",
        "pension_indicators",
        "family_benefits",
        "unemployment_accounts",
    ):
        if con.execute(f"select count(*) from {table}").fetchone() == (0,):
            raise ValueError(f"Empty social dataset: {table}")
