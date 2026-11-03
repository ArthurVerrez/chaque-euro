# Analyses implementation evidence, 2 November 2026

Prepared locally for review. No commit, push, deployment or remote resource creation.

The index and five requested routes render successfully. Paris remains partial: corrected
payments are verified, but receipts by equalisation fund are unavailable after OFGL export
timeouts. The page states that limitation and publishes no net equalisation balance.

Headline figures are computed from the primary files registered in `pipeline/sources.toml`:

| Article | Verified figures and exact primary locations |
|---|---|
| Deficit | 2025 APU balance -151.592 billion euros and -5.1% GDP; State national-accounts balance -128.103 billion and -4.3%. INSEE Figure 1/2, rows Ensemble and État. Debt 3,460.1 billion and 115.7% GDP, State contribution 2,822.7 billion and 94.4%, table 3.101. Budget result excluding IMF -124.7 billion, table 3.107. |
| Europe | FR column, sheet 2025: 25,092,958,294.96 euros contributed including customs/adjustments, 16,391,297,826.74 euros ordinary expenditure, 2,244,354,890.41 euros NGEU separately. Accounting balance -8,701,660,468.22 euros, -126.38 euros per resident. INSEE population 68,852,000 on 1 January 2025. Customs removal matches existing French PSR-UE of 22,961,730,323.08 euros. This is not the adjusted Commission operating balance. |
| Paris | CRC annex 5, 2023: Paris 3,216, Marseille 2,833, Lyon 2,791 euros operating spending per resident, with territorial budgets brought onto the CRC comparison perimeter. Corrected equalisation payments 713 million in 2024, FNGIR 898.2 million separately. The same report cites the Apur 2023 estimate of 3.6 million daily users and 2.1 million residents. Police special budget contribution 265.6 million and IDFM 455.3 million in 2024, table 25. |
| Rail | SDES A5.1-b, 2024: 8,624 million operating/current transfers plus 2,830 million investment, total 11,454 million to SNCF Voyageurs excluding pensions. A5.2-a: network investment subsidies 2,875.664 million. ART figure 8.1: TER commercial revenue 1,945.409 million / total 5,815.376 million = 33.453%, displayed 33.5%. INSEE 3.107: debt takeovers 25 billion (2020), 10 billion (2022). Programme 203 financier table: 1,561 million SNCF funds in executed 2025 CP. No consolidated public cost is manufactured by adding these overlapping perimeters. |
| Students | Existing PLRG 2025 CP: P150 15,314,401,974.73 euros, P231 3,205,790,716.56 euros. SIES Graphique 1 and Annexe 1: 656,114 BCS recipients, 34.5% of eligible students, rentrée 2025-2026, OLAFE extract 15 March 2026. DEPP note 25.52: 2024 average 13,300 euros in higher education, 12,460 at university, all funders, apprentices included. Ministerial announcement read on its official page confirms 4 May 2026 universal meals and 26 October 2026 indexation announcement for rentrée 2027. |

All binary sources were fetched with curl, opened and checked for period, units and scope.
Fetch sidecars preserve hashes and retrieval dates. Research-report numbers are not inputs.
The SIES/Crous count difference, EU balance convention and Paris daily-user estimate correct
research leads. Some HTML context pages returned anti-bot responses to curl and were read
through the public web reader instead; no anti-bot HTML was treated as data.

LFI 2026 CP: P150 15,724,196,101 euros; P231 3,274,887,522 euros.
PLF 2027 proposed CP: P150 15,786,054,527 euros; P231 3,330,717,209 euros.
These are extracted from the texts' état B, kept separate from execution.

Twenty new sources are registered: twelve downloaded inputs and eight reference pages.
Financial and context tables, all matched row-for-row against local D1 after patching:

| Table | Rows |
|---|---:|
| `deficit_series` | 77 |
| `eu_flows` | 26 |
| `eu_headings` | 45 |
| `paris_comparison` | 3 |
| `paris_context` | 6 |
| `rail_transfers` | 19 |
| `rail_network` | 24 |
| `rail_revenue` | 20 |
| `rail_context` | 3 |
| `student_scholarships` | 14 |
| `student_budget` | 6 |
| `student_cost` | 2 |
| `analysis_periods` | 10 |
| `analysis_events` | 4 |

Build-time reconciliations cover Commission headings/totals and French PSR, ART revenue,
SDES transfer and network financing totals, SIES echelon counts, Paris ratios and INSEE
balances. Tolerances and the exact 119.1-million-euro 2024 INSEE source discrepancy are
documented in `docs/datasets.md`. Unexpected drift raises an error. The EU regression test
covers header-row/label-column changes, whitespace, duplicate FR headers, adjustments and
NGEU separation.

Verification:

- Full `uv run chaque-euro run` passed, including reconciliation and SQLite/CSV/Parquet/seed export.
- Ruff format check, Ruff lint and strict mypy passed. Four unittest cases passed.
- Astro check: zero errors, warnings or hints. ESLint, Prettier and production build passed.
- Twelve Chrome Playwright page/viewport combinations returned HTTP 200, with no page errors,
  document/card overflow, clipped figures, clipped ticks, year-label overlap or broken images.
- Glossary popovers, collapsed method disclosures and TOC anchors checked at both widths.
- Existing home, State budget and public-money routes also returned 200 at 1280 px. The header
  was kept unchanged because an additional link does not fit its existing 1280 px layout;
  Analyses is available from home and the footer.
- Final PNGs were visually inspected as full-page layouts and detailed chart crops. Dev toolbar
  hidden only for screenshots. No physical-device or human visual acceptance is claimed.
- Local D1 patch included sources, source_urls, downloads, build and all new tables. The
  source_urls_source index was recreated. All 259 new rows match the built SQLite database.

Files changed (against the starting filesystem snapshot, excluding ignored build/cache data):

- `docs/analyses-verification.md`
- `docs/datasets.md`
- `pipeline/schema.sql`
- `pipeline/sources.toml`
- `pipeline/sql/31_deficit_series.sql`
- `pipeline/sql/32_europe.sql`
- `pipeline/sql/33_paris.sql`
- `pipeline/sql/34_rail.sql`
- `pipeline/sql/35_students.sql`
- `pipeline/sql/36_analysis_context.sql`
- `pipeline/sql/90_coverage.sql`
- `pipeline/src/chaque_euro/analyses.py`
- `pipeline/src/chaque_euro/build.py`
- `pipeline/tests/test_analyses.py`
- `site/src/components/AnalysisSection.astro`
- `site/src/components/KeyFigures.astro`
- `site/src/components/LineChart.astro`
- `site/src/layouts/Analysis.astro`
- `site/src/layouts/Base.astro`
- `site/src/lib/analyses.ts`
- `site/src/lib/data.ts`
- `site/src/lib/format.ts`
- `site/src/lib/glossary.ts`
- `site/src/pages/analyses/deficit-par-president.astro`
- `site/src/pages/analyses/etudiants.astro`
- `site/src/pages/analyses/europe.astro`
- `site/src/pages/analyses/index.astro`
- `site/src/pages/analyses/paris.astro`
- `site/src/pages/analyses/rail.astro`
- `site/src/pages/index.astro`

Final screenshot paths:

- `docs/screenshots/analyses-1440.png`
- `docs/screenshots/analyses-390.png`
- `docs/screenshots/analyses-deficit-par-president-1440.png`
- `docs/screenshots/analyses-deficit-par-president-390.png`
- `docs/screenshots/analyses-etudiants-1440.png`
- `docs/screenshots/analyses-etudiants-390.png`
- `docs/screenshots/analyses-europe-1440.png`
- `docs/screenshots/analyses-europe-390.png`
- `docs/screenshots/analyses-paris-1440.png`
- `docs/screenshots/analyses-paris-390.png`
- `docs/screenshots/analyses-rail-1440.png`
- `docs/screenshots/analyses-rail-390.png`

Remaining review points:

- Complete Paris paid-versus-received equalisation once fund-level primary receipts can be verified.
- The latest verified comparable territorial benchmark is CRC 2023, not a new 2025 reconstruction.
- Mon Master is named as part of the admissions issue; no equivalent reform is established by the
  October announcement. No unverified reform is claimed.
- Poppler's existing `pdftotext` command is required when rebuilding the CRC/DEPP extraction on
  another machine. No Python or Node dependency was added.
- New calculation links point at uncommitted SQL paths and need the reviewer’s normal publication
  process to make those files available remotely. This run did not publish code or data.
