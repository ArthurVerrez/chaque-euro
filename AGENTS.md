# Repo conventions

- Every source is fetched from its original publisher (ministry, agency, INSEE, Assemblée nationale, HATVP, DILA, European Commission...). Never ingest data from another transparency or aggregator site such as francetransparence.fr; those may be read only to discover what exists.
- Public information published by an administration is reusable under the CRPA (art. L321-1 and L322-1) even without an explicit licence: cite the source and its date, never alter or distort it. Exclude only what third-party rights, personal-data rules or a homologated restrictive licence protect. A website's general terms do not override this right.
- `pipeline/sources.toml` is the only place a source URL may appear. The pipeline downloads from it and copies it into the site database; the site renders every source link from the database. Never hard-code a dataset URL in `site/` or in SQL.
- Downloaded files are untrusted. They live in `data/raw/<source-id>/` (gitignored) next to a `.fetch.json` sidecar (URL, timestamp, SHA-256). Never execute anything from `data/`; code stays in `pipeline/`, data paths are passed as arguments.
- Transformations are DuckDB SQL files in `pipeline/sql/`, run in file-name order. The site links them as "Voir le calcul", so keep one concern per file and keep file paths stable.
- `pipeline/schema.sql` is the SQLite/D1 schema. Change it together with `site/src/lib/data.ts`.
- All data access in the site goes through `site/src/lib/data.ts`. It returns plain typed objects that carry their provenance (sources, record links, method, calculation link). Pages and components never query D1 directly. A future `/api/v1` and `/mcp` will reuse this module.
- Natural persons are never named: entrepreneurs individuels (Sirene category 1000) and non-diffusible units get a generic label and no SIREN, in the pipeline, before anything reaches the site. Exception: elected officials, ministers, election candidates and people appointed by decree or order published in the Journal officiel are named in their public role only (mandates, appointments, votes, HATVP declarations of interests, campaign accounts and official decisions about them). Journal officiel texts that the CRPA protects from indexing (naturalisations, name changes and similar personal records) are never republished. Never republish HATVP asset declarations (déclarations de situation patrimoniale).
- UI copy is plain French, neutral, addressed with "vous". Every figure has "Voir la source" and "Voir le calcul" in its collapsed sources toggle. Share cards, if any, show ratios only, never personal amounts.
- Icons are Lucide glyphs named by meaning in `site/src/lib/icons.ts` (one name per idea: `town` for a commune, `map` for a département…). Every section heading, key figure, badge and navigation link carries one.
- Glossary definitions live only in `site/src/lib/glossary.ts`. Mark a technical term in UI copy with `<Term id="...">` (or `term` on a key figure) the first time it appears in a section; the id is type-checked.
- Never use the em dash character anywhere. Default to zero code comments.
- No secrets, personal emails or local absolute paths in committed files.
- Checks: `cd pipeline && uv run ruff format --check . && uv run ruff check . && uv run mypy src`; `cd site && npm run check && npm run lint && npm run format:check`.
- Do not deploy or create remote Cloudflare resources without an explicit ask.
- Hosting and deployment are not part of this repository. Never add hosting details (machines, network, paths, accounts, tokens) to it, its commits or its issues.
