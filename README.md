# Chaque Euro

Chaque Euro (nom de travail) is an independent, politically neutral website that helps French citizens follow public money. It answers three questions first, in one sentence, with a link to the source of every figure:

- How much public money did this company or association receive? (`/organisation/<siren>`)
- How does my commune spend, per inhabitant, compared with communes of the same size? (`/commune/<code insee>`)
- Where does the State budget go? (`/budget-etat`)

Index pages `/organisations` (largest contract winners, grant recipients and buyers) and `/communes` (spending by population band, largest communes) help visitors browse without knowing a name.

`/communes` opens on a map of France by département; each `/departement/<code>` page maps its communes against the median of communes the same size, and every commune page shows a small locator map.

`/lexique` defines the terms the site uses (marché public, strate, médiane, épargne brute…). Words marked with a dotted underline and a magnifier link to their entry and show the short definition on hover.

Sources, data dates, known limits and the exact files fetched are listed on `/methodologie` and in `/methodologie/manifest.json`. The dataset inventory behind the choices is in [docs/datasets.md](docs/datasets.md).

AI assistants can use the public, read-only MCP server at `https://chaqueeuro.fr/mcp` (Streamable HTTP, no authentication). Its tools mirror the site's pages: each returns the same data as its page, with sources, method and calculation link, through `site/src/lib/data.ts`, plus the page URL. The server is defined in `site/src/lib/mcp.ts`.

## Layout

| Path | What it holds |
|---|---|
| `pipeline/sources.toml` | Source registry: the only place a dataset URL is written |
| `pipeline/src/chaque_euro/` | CLI, downloader with SHA-256 sidecars, build and export |
| `pipeline/sql/` | DuckDB transformations, one concern per file, linked from the site as "Voir le calcul" |
| `pipeline/schema.sql` | SQLite schema shared by the local SQLite file and Cloudflare D1 |
| `site/` | Astro site for Cloudflare Workers, data access in `site/src/lib/data.ts` |
| `data/raw/`, `data/build/` | Downloads and outputs (gitignored) |

## Run the pipeline

Requires [uv](https://docs.astral.sh/uv/) and Poppler's `pdftotext` (`brew install poppler`), used to read two PDF sources. From the repo root:

The social accounts also use `pdftotext`. File downloads use the system certificate store through `truststore`; the native `curl` command provides a verified HTTPS fallback when a publisher rejects Python's TLS handshake.

```sh
cd pipeline
uv sync
uv run chaque-euro run
```

This downloads every source in `pipeline/sources.toml` into `data/raw/<source>/` (cached: delete a file or pass `--refresh` to fetch again), runs `pipeline/sql/*.sql` in DuckDB, and writes to `data/build/`:

- `downloads/<table>.parquet` and `downloads/<table>.csv.zip`: the public download set listed on `/telechargements` (all data tables except the search index and map shapes, which are derived from ODbL boundaries)
- `chaque-euro.sqlite`: the same tables in SQLite
- `d1-seed/*.sql`: SQL statements (under the D1 100 KB statement limit) that recreate the database in D1, split into files of at most 100 MB because a single larger file fails to load into the local D1
- `manifest.json`: per source, the exact URLs fetched, retrieval time, data coverage, row count and SHA-256

`uv run chaque-euro fetch --only decp` downloads a single source. `--raw-dir` and `--build-dir` change the data locations.

The OFGL commune accounts are fetched for 2018 to 2025 (`years` in `sources.toml`). The OFGL export endpoint times out on this dataset, so the pipeline pages through the records API by département and year (816 requests, about 13 minutes).

## Run the site locally

Tested with Node 24.

```sh
cd site
npm install
npm run db:seed:local   # loads data/build/d1-seed/*.sql into the local D1 (.wrangler/state)
npm run build
npx wrangler dev --persist-to .wrangler/state   # http://localhost:8787
```

`npm run dev` (Astro dev server on workerd) uses the same local D1. `npm run check` regenerates `worker-configuration.d.ts` with `wrangler types` before type-checking.

Regenerate the share card with `node site/scripts/render-share.mjs` (Chrome on macOS or Chromium on PATH; `CHROME_BIN` overrides the executable).

Screenshots of the main pages at 390 px and 1440 px are in `docs/screenshots/`.

Checks:

```sh
cd site && npm run check && npm run lint && npm run format:check
cd pipeline && uv run ruff format --check . && uv run ruff check . && uv run mypy src
```

## Architecture choice

Checked against Cloudflare's published limits on 31 October 2026 ([D1](https://developers.cloudflare.com/d1/platform/limits/), [Workers](https://developers.cloudflare.com/workers/platform/limits/)):

- Static assets: 20 000 files per Worker version on the Free plan, 100 000 on Paid. The site has about 210 000 organisation pages and 35 000 commune pages, so prerendering every entity page does not fit. Entity pages are rendered on request from D1 and cached at the edge (`Cache-Control: s-maxage=3600`).
- D1: 500 MB per database on Free, 10 GB on Paid; 100 KB per SQL statement; 50 queries per invocation on Free. The current build is 475 MB in SQLite (211 342 organisations, 659 447 contracts, 34 875 communes with 8 years of accounts), close to the Free limit. The database keeps, per organisation and role, the 8 largest and 3 most recent contracts rather than every contract. Each page runs at most two D1 round trips (`batch()`).
- Worker bundle: 64 MiB limit, far above this site.
- Search uses SQLite FTS5 in D1.
- Bulk files on R2 are not needed for this slice: every figure links to the original dataset and file. Publishing our derived Parquet files on R2 is a next step.

Astro sessions and the Cloudflare Images binding are disabled so a future deploy does not provision a KV namespace or Images binding.

## Hosting

The public site is https://chaqueeuro.fr. Hosting and deployment are not part of this repository.

## Licence

Code: [GNU AGPL-3.0](LICENSE), copyright 2026 Arthur Verrez.

Derived data published on `/telechargements`: [Licence Ouverte 2.0](https://www.data.gouv.fr/pages/legal/licences/etalab-2-0). Cite Chaque Euro with a link. Each source keeps its own licence, listed on `/methodologie`.
