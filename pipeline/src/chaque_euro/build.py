import hashlib
import json
import sqlite3
import zipfile
from collections.abc import Iterable, Iterator, Sequence
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path

import duckdb

from . import (
    analyses,
    constituency_shapes,
    democracy,
    documents,
    geo,
    gleif,
    groups,
    lfi,
    local_money,
    national,
    procurement,
    public_accounts,
    public_roles,
    social,
    territorial,
)
from .fetch import FetchRecord, sha256_of
from .registry import Source, load_registry
from .source_dates import source_data_date

PIPELINE_DIR = Path(__file__).resolve().parents[2]
SQL_DIR = PIPELINE_DIR / "sql"
SCHEMA_PATH = PIPELINE_DIR / "schema.sql"
DATA_TABLES = (
    "org_groups",
    "org_group_members",
    "org_group_amounts",
    *documents.TABLES,
    "lobbying_organisations",
    "lobbying_exercises",
    "lobbying_activities",
    "lobbying_targets",
    "lobbying_defaults",
    "lobbying_quarters",
    "lobbying_recent",
    "lobbying_latest",
    "lobbying_crossrefs",
    "eu_lobbying",
    "eu_lobbying_interests",
    "party_accounts",
    "party_aid_losses",
    "social_branches",
    "social_ondam",
    "health_payers",
    "pension_indicators",
    "family_benefits",
    "unemployment_accounts",
    "local_accounts",
    "commune_taxes",
    "tax_strata",
    "commune_income",
    "commune_turnout",
    "department_turnout",
    "commune_dgf_history",
    "public_people",
    "public_organs",
    "public_mandates",
    "public_ballots",
    "public_votes",
    "public_vote_corrections",
    "public_person_metrics",
    "interest_declarations",
    "declared_interests",
    "campaign_accounts",
    "campaign_account_lines",
    "campaign_decisions",
    "rne_statistics",
    "local_executives",
    "commune_constituencies",
    "constituency_shapes",
    "mandate_constituencies",
    "commune_function_labels",
    "commune_functions",
    "commune_function_strata",
    "cada_opinions",
    "expense_reference_values",
    "cabinet_statistics",
    "transparency_alerts",
    "state_monthly",
    "state_titles",
    "state_ministries",
    "state_assets",
    "compulsory_levies",
    "european_finances",
    "european_functions",
    "quarterly_debt",
    "social_benefits",
    "green_budget",
    "procurement_breakdown",
    "procurement_quality",
    "procurement_competition",
    "procurement_latest",
    "procurement_notices",
    "procurement_projects",
    "competition_decisions",
    "competition_companies",
    "orgs",
    "org_years",
    "org_counterparts",
    "source_files",
    "contracts",
    "org_contracts",
    "grants",
    "budget",
    "revenue",
    "budget_voted",
    "deficit_series",
    "eu_flows",
    "eu_headings",
    "paris_comparison",
    "paris_context",
    "rail_network",
    "rail_transfers",
    "rail_revenue",
    "rail_context",
    "student_scholarships",
    "student_budget",
    "student_cost",
    "analysis_periods",
    "analysis_events",
    "public_finances",
    "public_accounts",
    "public_functions",
    "communes",
    "commune_years",
    "finance_items",
    "commune_finances",
    "strata",
    "departements",
    "commune_shapes",
    "facts",
    "timeline",
    "search",
)
META_TABLES = ("build", "sources", "source_urls", "downloads")
DOWNLOADS = {
    "constituency_shapes": "Contours Insee des communes partagées, simplifiés et indicatifs.",
    "commune_constituencies": "Correspondance officielle communes-circonscriptions législatives.",
    "mandate_constituencies": "Circonscriptions des mandats AN de la XVIIe législature.",
    "commune_function_labels": "Libellés des services, nomenclatures M14 et M57 séparées.",
    "commune_functions": (
        "Fonctionnement et équipements 2024-2025 des budgets principaux, par service et habitant."
    ),
    "commune_function_strata": "Médianes par service, à partir de cinq communes comparables.",
    "org_groups": "Groupes documentés par un éditeur officiel, périmètre partiel et daté.",
    "org_group_members": "Entités diffusables et liens officiels de contrôle ou de consolidation.",
    "org_group_amounts": "Montants par entité, mesure et année ; absences distinctes de zéro.",
    "procurement_competition": "Offre unique depuis 2024, couverture par acheteur et famille CPV.",
    **{
        table: "Documents officiels et structures administratives, données filtrées."
        for table in documents.TABLES
    },
    "lobbying_organisations": "Organisations HATVP, personnes morales vérifiées.",
    "lobbying_exercises": "Exercices et fourchettes de dépenses déclarées à la HATVP.",
    "lobbying_activities": "Fiches d\u2019activité et date de publication, sans texte libre.",
    "lobbying_targets": "Catégories d\u2019institutions et ministères ciblés par fiche.",
    "lobbying_defaults": "Défauts de déclaration figurant dans la liste officielle HATVP.",
    "lobbying_quarters": "Fiches publiées par trimestre, pas dates des actions.",
    "lobbying_crossrefs": "SIREN communs aux lobbyistes, marchés et versements publics.",
    "eu_lobbying": "Organisations françaises UE, coûts et formes juridiques vérifiées.",
    "eu_lobbying_interests": "Domaines d\u2019intérêt du registre UE, libellés officiels.",
    "party_accounts": "Comptes des partis en euros, exercices 2021 à 2024, non consolidés.",
    "party_aid_losses": "Perte de l\u2019aide publique expressément publiée par la CNCCFP.",
    "procurement_breakdown": "Marchés depuis 2019 : mois, département, procédure, type.",
    "procurement_quality": "Publication déclarée par année et catégorie juridique acheteur.",
    "procurement_latest": "Derniers marchés notifiés, identités protégées.",
    "procurement_notices": "Avis BOAMP avec échéance future lors de la collecte.",
    "procurement_projects": "Projets APProch ouverts avec date prévisionnelle future.",
    "competition_decisions": "Sanctions initiales par décision, avant recours.",
    "competition_companies": "Sanctions par société, non additionnables (solidarité possible).",
    "social_branches": "Comptes des cinq branches, résultats et prévisions par version.",
    "social_ondam": "ONDAM 2024-2026, édition du PLFSS 2026, euros.",
    "health_payers": "Dépense courante de santé par financeur, DREES, euros.",
    "pension_indicators": "Retraités et pension mensuelle brute de droit direct, DREES.",
    "family_benefits": "Prestations gérées par les caisses de la branche famille, tous régimes.",
    "unemployment_accounts": "Recettes et dépenses de l'assurance chômage, Unédic, euros.",
    "local_accounts": "Comptes OFGL 2018-2025, niveaux séparés, euros et euros par habitant.",
    "commune_taxes": "REI 2025, bases en euros et taux en pourcentage, par bénéficiaire et zone.",
    "tax_strata": "Médianes REI 2025 par strate, taxe, bénéficiaire et zone.",
    "commune_income": (
        "IRCOM, revenus 2024, foyers et montants convertis en euros, secret fiscal conservé."
    ),
    "commune_turnout": "Participation électorale par commune et scrutin, sans résultats partisans.",
    "department_turnout": "Participation départementale pondérée par les inscrits du scrutin.",
    "commune_dgf_history": "DGF comptabilisée par les communes, euros courants, 2018-2025.",
    "public_people": (
        "Identités publiques des parlementaires et membres du gouvernement du "
        "répertoire AN, sans naissance ni contacts."
    ),
    "public_organs": "Organes et groupes parlementaires officiels.",
    "public_mandates": "Mandats et appartenances datées, champs publics uniquement.",
    "public_ballots": (
        "Scrutins publics de la XVIIe législature AN et du Sénat depuis le 8 juillet 2024."
    ),
    "public_votes": (
        "Positions nominatives officielles, délégations et statuts distincts de"
        " la présence physique."
    ),
    "public_vote_corrections": "Références de corrections, distinctes des votes comptabilisés.",
    "public_person_metrics": (
        "Participation aux scrutins publics pendant le mandat, numérateur et "
        "dénominateur, deux fenêtres."
    ),
    "interest_declarations": (
        "Inventaire courant des déclarations DI, DIM, DIA, DIAM livrées et "
        "rapprochées avec une identité officielle."
    ),
    "declared_interests": (
        "Nombre de rubriques structurées déclarées, sans organisation, rémunération ou texte libre."
    ),
    "campaign_accounts": (
        "Comptes publiés des législatives et européennes 2024. Montants en "
        "centimes, décisions administratives."
    ),
    "campaign_account_lines": (
        "Dépenses déclarées et retenues des campagnes, en centimes, sans "
        "identité de donateur ni prêteur."
    ),
    "campaign_decisions": (
        "Index partiel des décisions municipales 2026. Résultat et montants "
        "dans les documents officiels."
    ),
    "rne_statistics": (
        "Lignes de mandats RNE par catégorie, département, sexe et tranche "
        "d'âge. Pas un décompte de personnes uniques."
    ),
    "local_executives": (
        "Maires : identité de fonction, commune et dates de mandat, sans "
        "naissance, contacts ou profession."
    ),
    "cada_opinions": (
        "Métadonnées CADA sans texte libre, noms de requérants ou "
        "administrations. Sens chevauchants par dossier."
    ),
    "expense_reference_values": (
        "Indemnités brutes, enveloppes de frais, plafonds locaux et charges "
        "institutionnelles. Centimes et dates explicites."
    ),
    "cabinet_statistics": (
        "Effectifs agrégés des cabinets au 1er juillet 2025, PLF 2026. Aucune "
        "rémunération individuelle."
    ),
    "transparency_alerts": (
        "Statuts CNCCFP explicites : rejet, non-dépôt, dépôt tardif. Ni score "
        "de suspicion ni qualification pénale."
    ),
    "state_monthly": "Exécution budgétaire mensuelle cumulée, euros, données provisoires.",
    "state_titles": "Dépenses exécutées 2025 par titre, crédits de paiement.",
    "state_ministries": "Dépenses exécutées 2025 par ministère, nomenclature de gestion.",
    "state_assets": "Bilan comptable de l'État au 31 décembre 2025, euros.",
    "compulsory_levies": "Prélèvements obligatoires par bénéficiaire et principaux impôts, euros.",
    "european_finances": "Finances publiques comparées, en pourcentage du PIB, Eurostat.",
    "european_functions": "Dépenses publiques par fonction, en pourcentage du PIB, Eurostat.",
    "quarterly_debt": "Dette trimestrielle de Maastricht, France, euros et pourcentage du PIB.",
    "social_benefits": "Prestations de protection sociale par risque, tous régimes, euros.",
    "green_budget": "Crédits budgétaires du PLF 2026 par cotation environnementale.",
    "rail_network": "Subventions à SNCF Réseau, SDES 2001-2024, financeurs séparés.",
    "deficit_series": "Soldes et dette État/APU, euros et PIB, 1949-2025 selon disponibilité.",
    "eu_flows": "Flux France-UE 2000-2025, solde comptable et population.",
    "eu_headings": "Dépenses UE en France par rubrique, hors NGEU, 2021-2025.",
    "paris_comparison": "Comparaison CRC 2023 : Paris, Marseille, Lyon, périmètres rapprochés.",
    "paris_context": "Contexte parisien extrait du rapport CRC 2025, année précisée par ligne.",
    "rail_transfers": "Transferts vers SNCF Voyageurs hors retraites, SDES 2006-2024.",
    "rail_revenue": "Revenus commerciaux et publics par service ferroviaire, ART, euros 2024.",
    "rail_context": "Dette SNCF Réseau reprise et fonds affectés SNCF, flux séparés.",
    "student_scholarships": "Boursiers MESR-SIES, formations éligibles, rentrées 2012 à 2025.",
    "student_budget": "Programmes 150 et 231, CP exécutés 2025, votés 2026, proposés 2027.",
    "student_cost": "Dépense par étudiant, compte éducation 2024, tous financeurs.",
    "orgs": (
        "Organisations identifiées par leur SIREN : nom, catégorie, activité, totaux des marchés "
        "remportés et attribués, versements de l'État reçus."
    ),
    "org_years": (
        "Montant et nombre de marchés par organisation, rôle (titulaire ou acheteur) et année."
    ),
    "org_counterparts": (
        "Principaux partenaires de chaque organisation : ses acheteurs si elle est titulaire, ses"
        " titulaires si elle est acheteur."
    ),
    "contracts": (
        "Marchés publics retenus pour les pages : les plus gros et les plus récents de chaque "
        "organisation, avec objet, montant et date."
    ),
    "org_contracts": (
        "Lien entre organisations et marchés, avec le rôle et la part estimée du montant."
    ),
    "source_files": "Fichiers DECP d'origine cités par les marchés.",
    "grants": (
        "Versements de l'État aux associations en 2025 (annexe Jaune du PLF 2027), "
        "ligne par ligne. "
        "Inclut subventions, prestations de services et autres versements."
    ),
    "budget": "Dépenses exécutées du budget général de l'État en 2025, par mission et programme.",
    "revenue": (
        "Recettes encaissées par le budget général de l'État en 2025, par catégorie et par impôt."
    ),
    "budget_voted": "Crédits de paiement votés pour 2026 (loi de finances), mission par mission.",
    "public_finances": (
        "Dépenses et recettes de l'État, de ses opérateurs, des collectivités et de la Sécurité "
        "sociale depuis 1978 (comptabilité nationale, Insee)."
    ),
    "public_accounts": (
        "Dépenses, recettes et soldes par nature des familles d'administrations publiques "
        "et de leurs composantes depuis 1978 (Insee)."
    ),
    "public_functions": (
        "Dépenses de toutes les administrations publiques par fonction (santé, enseignement…) et "
        "par sous-secteur, sans doublons, depuis 2009 (Insee)."
    ),
    "communes": (
        "Communes : code Insee, nom, département, population et strate de la dernière année."
    ),
    "commune_years": "Population et strate de chaque commune, année par année.",
    "finance_items": "Postes des comptes communaux repris sur le site.",
    "commune_finances": (
        "Comptes des communes de 2018 à 2025 : montant total et montant par habitant, poste par "
        "poste."
    ),
    "strata": "Médiane par habitant de chaque strate de population, par année et par poste.",
    "departements": "Totaux des communes par département pour la dernière année.",
    "facts": "Chiffres clés affichés sur l'accueil.",
    "timeline": "Nombre et montant des marchés publiés chaque année.",
}
DOWNLOAD_COLUMNS = {
    "departements": "code, name, communes, population, spending, per_capita, year",
}
PATH_VARIABLES = {
    "ofgl-departements": "ofgl_departements_path",
    "ofgl-regions": "ofgl_regions_path",
    "ofgl-epci": "ofgl_epci_path",
    "insee-deficit": "insee_deficit_path",
    "insee-debt": "insee_debt_path",
    "state-balance": "state_balance_path",
    "sdes-rail": "sdes_rail_path",
    "art-rail": "art_rail_path",
    "sies-grants": "sies_grants_path",
    "approch": "approch_path",
    "competition-sanctions": "sanctions_path",
    "decp": "decp_path",
    "sirene": "sirene_path",
    "ofgl-communes": "ofgl_path",
    "jaune-associations": "jaune_path",
    "plrg-2025": "plrg_path",
    "plrg-2025-recettes": "plrg_revenue_path",
    "insee-apu": "insee_apu_path",
    "insee-apu-fonctions": "insee_functions_path",
}
MAX_STATEMENT_BYTES = 90_000
MAX_SEED_FILE_BYTES = 100_000_000

type Value = str | int | float | None


def _transform(con: duckdb.DuckDBPyConnection, records: dict[str, FetchRecord]) -> str:
    con.execute("install excel; load excel")
    for source_id, variable in PATH_VARIABLES.items():
        con.execute(f"set variable {variable} = ?", [records[source_id].path])
    con.execute("set variable decp_retrieved_on = ?::date", [records["decp"].retrieved_at[:10]])
    con.execute("set variable procurement_as_of = ?::date", [records["boamp"].retrieved_at[:10]])
    procurement.load(con, records)
    households = next(s.value for s in load_registry() if s.id == "insee-menages")
    con.execute("set variable households = ?", [households])
    france_viewbox = geo.load(
        con, records["contours-departements"].path, records["contours-communes"].path
    )
    lfi.load(con, records["lfi-2026"].path)
    public_accounts.load(con, records["insee-apu-comptes"].path)
    analyses.load(con, records)
    national.load(con, records)
    documents.load(con, records)
    democracy.load(con, records)
    social.load(con, records)
    local_money.load(con, records)
    public_roles.load(con, records)
    groups.load(con, records)
    gleif.load(con, records)
    territorial.load(con, records)
    constituency_shapes.load(con, records)
    for script in sorted(SQL_DIR.glob("*.sql")):
        print(f"  sql {script.name}", flush=True)
        con.execute(script.read_text(encoding="utf-8"))
    public_accounts.validate(con)
    analyses.validate(con)
    procurement.validate(con)
    national.validate(con)
    democracy.validate(con)
    social.validate(con)
    local_money.validate(con)
    public_roles.validate(con)
    groups.validate(con)
    territorial.validate(con)
    return france_viewbox


def _source_rows(
    sources: list[Source],
    records: dict[str, FetchRecord],
    coverage: dict[str, tuple[int, str, str | None]],
) -> list[tuple[Value, ...]]:
    rows: list[tuple[Value, ...]] = []
    for source in sources:
        record = records.get(source.id)
        count, covered, data_date = coverage.get(source.id, (None, source.vintage, None))
        rows.append(
            (
                source.id,
                source.short_name,
                source.name,
                source.publisher,
                source.page_url,
                source.file_url,
                source.record_url,
                source.code_url,
                source.licence.name,
                source.licence.url,
                source.frequency,
                source.usage,
                json.dumps(source.limits, ensure_ascii=False),
                record.retrieved_at if record else None,
                record.published_at if record else None,
                covered,
                count,
                record.sha256 if record else None,
                source.value,
                data_date or source_data_date(source, record),
                source.freshness_retrieval_days,
                source.freshness_data_days,
                (record.checked_at or record.retrieved_at) if record else None,
                record.error if record else None,
                int(source.download_expected),
            )
        )
    return rows


def _columns(db: sqlite3.Connection, table: str) -> list[str]:
    return [row[1] for row in db.execute(f"pragma table_info({table})")]


def _insert(db: sqlite3.Connection, table: str, rows: Iterable[Sequence[Value]]) -> None:
    columns = _columns(db, table)
    placeholders = ", ".join("?" for _ in columns)
    db.executemany(f"insert into {table} ({', '.join(columns)}) values ({placeholders})", rows)


def _write_sqlite(
    con: duckdb.DuckDBPyConnection,
    path: Path,
    meta: dict[str, list[tuple[Value, ...]]],
) -> None:
    path.unlink(missing_ok=True)
    db = sqlite3.connect(path)
    db.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    for table in DATA_TABLES:
        cursor = con.execute(
            f"select {', '.join(_columns(db, table))} from {table}"
            + (" order by all" if table == "search" else "")
        )
        while batch := cursor.fetchmany(50_000):
            _insert(db, table, batch)
    for table, rows in meta.items():
        _insert(db, table, rows)
    db.commit()
    db.execute("vacuum")
    db.close()


def _literal(value: Value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, int | float):
        return repr(value)
    return "'" + value.replace("'", "''") + "'"


def _seed_statements(db: sqlite3.Connection) -> Iterator[str]:
    for table in (*META_TABLES, *DATA_TABLES):
        yield f"DROP TABLE IF EXISTS {table};\n"
    yield SCHEMA_PATH.read_text(encoding="utf-8")
    for table in (*META_TABLES, *DATA_TABLES):
        columns = ", ".join(_columns(db, table))
        header = f"INSERT INTO {table} ({columns}) VALUES\n"
        batch: list[str] = []
        size = len(header)
        for row in db.execute(f"select {columns} from {table}"):
            values = "(" + ", ".join(_literal(value) for value in row) + ")"
            length = len(values.encode("utf-8")) + 2
            if batch and size + length > MAX_STATEMENT_BYTES:
                yield header + ",\n".join(batch) + ";\n"
                batch, size = [], len(header)
            batch.append(values)
            size += length
        if batch:
            yield header + ",\n".join(batch) + ";\n"


def _write_seed(sqlite_path: Path, seed_dir: Path) -> None:
    seed_dir.mkdir(exist_ok=True)
    for stale in seed_dir.glob("*.sql"):
        stale.unlink()
    db = sqlite3.connect(sqlite_path)
    part, written = 1, 0
    out = (seed_dir / f"{part:03}.sql").open("w", encoding="utf-8")
    for statement in _seed_statements(db):
        size = len(statement.encode("utf-8"))
        if written and written + size > MAX_SEED_FILE_BYTES:
            out.close()
            part, written = part + 1, 0
            out = (seed_dir / f"{part:03}.sql").open("w", encoding="utf-8")
        out.write(statement)
        written += size
    out.close()
    db.close()


def _write_downloads(con: duckdb.DuckDBPyConnection, directory: Path) -> list[tuple[Value, ...]]:
    directory.mkdir(exist_ok=True)
    for stale in directory.iterdir():
        stale.unlink()
    rows: list[tuple[Value, ...]] = []
    for table, description in DOWNLOADS.items():
        query = f"select {DOWNLOAD_COLUMNS.get(table, '*')} from {table}"
        (count,) = con.execute(f"select count(*) from ({query})").fetchone() or (0,)
        parquet = directory / f"{table}.parquet"
        con.execute(f"copy ({query}) to '{parquet}' (format parquet, compression zstd)")
        csv = directory / f"{table}.csv"
        con.execute(f"copy ({query}) to '{csv}' (header)")
        archive = directory / f"{table}.csv.zip"
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zipped:
            zipped.write(csv, csv.name)
        csv.unlink()
        for path, file_format in ((parquet, "parquet"), (archive, "csv")):
            rows.append(
                (
                    path.name,
                    table,
                    file_format,
                    description,
                    count,
                    path.stat().st_size,
                    sha256_of(path),
                )
            )
    return rows


def pipeline_hash() -> str:
    paths = [
        *sorted((PIPELINE_DIR / "src").rglob("*.py")),
        *sorted(SQL_DIR.rglob("*.sql")),
        SCHEMA_PATH,
        PIPELINE_DIR / "sources.toml",
    ]
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.relative_to(PIPELINE_DIR).as_posix().encode() + b"\0")
        digest.update(path.read_bytes() + b"\0")
    return digest.hexdigest()


def build(records: dict[str, FetchRecord], build_dir: Path) -> None:
    sources = load_registry()
    build_dir.mkdir(parents=True, exist_ok=True)

    con = duckdb.connect()
    france_viewbox = _transform(con, records)
    downloads = _write_downloads(con, build_dir / "downloads")

    coverage = {
        source_id: (rows, text, data_date)
        for source_id, rows, text, data_date in con.execute(
            "select c.source_id, c.rows, c.coverage, d.data_date::varchar "
            "from coverage c left join coverage_dates d using (source_id)"
        ).fetchall()
    }
    built_at = datetime.now(UTC).isoformat(timespec="seconds")
    meta: dict[str, list[tuple[Value, ...]]] = {
        "build": [("built_at", built_at), ("france_viewbox", france_viewbox)],
        "sources": _source_rows(sources, records, coverage),
        "source_urls": [
            (record.source_id, url) for record in records.values() for url in record.urls
        ],
        "downloads": downloads,
    }

    sqlite_path = build_dir / "chaque-euro.sqlite"
    _write_sqlite(con, sqlite_path, meta)
    _write_seed(sqlite_path, build_dir / "d1-seed")

    manifest = {
        "built_at": built_at,
        "pipeline_hash": pipeline_hash(),
        "sources": [
            {
                "id": source.id,
                "name": source.name,
                "page_url": source.page_url,
                "licence": source.licence.name,
                "coverage": coverage.get(source.id, (None, source.vintage, None))[1],
                "data_date": coverage.get(source.id, (None, None, None))[2]
                or source_data_date(source, records.get(source.id)),
                "rows": coverage.get(source.id, (None, None, None))[0],
                **(
                    {k: v for k, v in asdict(records[source.id]).items() if k != "path"}
                    if source.id in records
                    else {"value": source.value}
                ),
            }
            for source in sources
        ],
    }
    (build_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    for table in DATA_TABLES:
        (count,) = con.execute(f"select count(*) from {table}").fetchone() or (0,)
        print(f"  {table}: {count} rows", flush=True)
    print(f"built {sqlite_path} ({sqlite_path.stat().st_size / 1e6:.0f} MB)", flush=True)
