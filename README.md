# Chaque Euro

**Where French public money goes, with the source of every figure.**

[chaqueeuro.fr](https://chaqueeuro.fr) · [Use it with an AI assistant](https://chaqueeuro.fr/ia) · [Download the data](https://chaqueeuro.fr/telechargements) · [Sources and method](https://chaqueeuro.fr/methodologie)

![Chaque Euro home page](docs/screenshots/readme-home.png)

Chaque Euro is an independent, non-partisan website (in French) that turns official open data into plain answers. How much public money did this company or association receive? How does my commune spend compared with communes of the same size? Where does the State budget go? Who represents me, and how do they vote?

Every figure links to the publisher's own file and to the code in this repository that computed it.

## What's inside

| Section | What you find |
|---|---|
| [Organisations](https://chaqueeuro.fr/organisations) | Public contracts won and awarded since 2019, State grants, lobbying and company groups, for about 210,000 companies, associations and public bodies |
| [Communes](https://chaqueeuro.fr/communes) | Spending, revenue, debt and local taxes per inhabitant over 8 years for every commune (about 35,000), compared with the median of communes the same size and mapped by département |
| [Public money](https://chaqueeuro.fr/argent-public) | The State budget, Social Security, State operators and local authorities, from national accounts down to each programme |
| [Elected officials](https://chaqueeuro.fr/elus) | Your deputy and senators from your address, their votes, declarations of interests, campaign accounts and party finance |
| [Procurement](https://chaqueeuro.fr/marches-publics), [lobbying](https://chaqueeuro.fr/lobbying), [law](https://chaqueeuro.fr/documents/dossiers) | Procurement trends, lobbying registers, the Journal officiel, legislative files and administrations |
| [Analyses](https://chaqueeuro.fr/analyses) | Short data stories: the deficit president by president, what France pays to and gets from the EU, why Paris spends more, the cost of rail, students |

<p>
  <img src="docs/screenshots/readme-commune.png" width="49%" alt="Commune page for Lyon">
  <img src="docs/screenshots/readme-organisation.png" width="49%" alt="Organisation page for EDF">
</p>

## Principles

- **Every figure is sourced.** "Voir la source" opens the publisher's page, file or record. "Voir le calcul" opens the SQL or Python file here that produced the number.
- **Original publishers only.** Over 110 sources from 55 publishers, among them ministries, INSEE, DGFiP, OFGL, HATVP, CNCCFP, the Assemblée nationale, the Sénat, DILA and the European Commission. Each shows its data date. Nothing comes from another aggregator.
- **Neutral.** Figures are shown as published, next to fair references such as communes of the same size or previous years. No scores, no accusations.
- **Privacy.** Sole traders and non-public units are never named. Officials appear only in their public role. No cookies, only aggregate audience statistics.

## Use it with an AI assistant

The read-only MCP server at `https://chaqueeuro.fr/mcp` gives Claude, ChatGPT and other assistants the same data as the site, with its sources. No account is needed.

- **Claude** (Free plan included): Customize > Connectors > Add > Add custom connector, paste the URL, choose no sign-in.
- **Claude Code**: `claude mcp add --transport http chaque-euro https://chaqueeuro.fr/mcp`
- **Others**: add a remote MCP server (Streamable HTTP) with the same URL.

Its 33 tools mirror the site's pages and are defined in [`site/src/lib/mcp.ts`](site/src/lib/mcp.ts).

## Open data

Every derived table is on [/telechargements](https://chaqueeuro.fr/telechargements) as CSV and Parquet, under Licence Ouverte 2.0. [`/methodologie/manifest.json`](https://chaqueeuro.fr/methodologie/manifest.json) lists, for each source, the exact URLs fetched, when, the data coverage, the row count and the SHA-256 of each file.

## How it works

```
pipeline/sources.toml → download, with SHA-256 sidecars → DuckDB SQL → SQLite, CSV, Parquet, manifest → Astro site and MCP server
```

| Path | What it holds |
|---|---|
| `pipeline/sources.toml` | The source registry, the only place a dataset URL is written |
| `pipeline/src/chaque_euro/` | CLI, downloader, build and export |
| `pipeline/sql/` | DuckDB transformations, one concern per file, linked from the site as "Voir le calcul" |
| `pipeline/schema.sql` | The SQLite schema |
| `site/` | The Astro site for the Cloudflare Workers runtime with a D1 database |
| `site/src/lib/data.ts` | The single data module, shared by every page and the MCP server |
| `docs/datasets.md` | The dataset inventory behind the choices |

Pages are rendered on request, with at most two database round trips each, and cached. Search uses SQLite FTS5. The data refreshes nightly, and a new build is published only if it passes integrity and row-count checks.

## Run it locally

You need [uv](https://docs.astral.sh/uv/), Poppler's `pdftotext` (`brew install poppler`) and Node 24.

Build the data:

```sh
cd pipeline
uv sync
uv run chaque-euro run
```

This downloads every source into `data/raw/<source>/` (cached; pass `--refresh` to fetch again), runs `pipeline/sql/*.sql` in DuckDB and writes to `data/build/`: the SQLite database, the CSV and Parquet downloads, D1 seed files and `manifest.json`. `uv run chaque-euro fetch --only decp` fetches a single source. The OFGL commune accounts take about 13 minutes, because the pipeline pages through their API by département and year.

Run the site:

```sh
cd site
npm install
npm run db:seed:local
npm run build
npx wrangler dev --persist-to .wrangler/state   # http://localhost:8787
```

Checks:

```sh
cd site && npm run check && npm run lint && npm run format:check && npm test
cd pipeline && uv run ruff format --check . && uv run ruff check . && uv run mypy src
```

## Corrections and contributions

Spotted a wrong figure? Write to contact@polastra.com (see [Demander une correction](https://chaqueeuro.fr/mentions-legales#correction)) or open an issue. If the error is in the official source, please tell its publisher too.

Pull requests are welcome. The repository's conventions are in [AGENTS.md](AGENTS.md).

## Licence

Code: [GNU AGPL-3.0](LICENSE), copyright 2026 Arthur Verrez.

Derived data: [Licence Ouverte 2.0](https://www.data.gouv.fr/pages/legal/licences/etalab-2-0). Cite Chaque Euro with a link. Each source keeps its own licence, listed on [/methodologie](https://chaqueeuro.fr/methodologie).
