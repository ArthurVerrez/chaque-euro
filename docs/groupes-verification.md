# Documented organisation groups, 4 November 2026

Prepared locally for review. GLEIF Golden Copy release: 4 November 2026, 08:00 UTC.
The complete SNCF report-based perimeter remains at 31 December 2025.

## Source choice

The three inputs are registered in `pipeline/sources.toml`: `gleif-entities`,
`gleif-relationships`, and `gleif-registration-authorities`. GLEIF publishes its
LEI data under CC0 1.0. It maintains the authoritative repository of the official
Global LEI System under LEI ROC oversight. Its Golden Copy is a primary publication
of that system. It is not a transparency site inferring links between companies.

The Registration Authorities List identifies RA000189 as Sirene, maintained by
INSEE, and RA000192 as the commercial register maintained by Infogreffe. Accept
nine digits, either contiguous or presented as three groups of three digits.
Remove only those presentation spaces, then require an exact Sirene match.
Vinci, EDF and Thales use spaced Infogreffe identifiers. Registry prefixes and
other registration authorities are excluded. Displayed names come from Sirene.

The APE portfolio is an official source of State participations, including minority
stakes. The published portfolio does not provide a comprehensive machine-readable
list of subsidiaries with SIREN. A common State shareholder does not establish a
single accounting group. It is therefore not used to connect these organisations.
Issuer annual reports, including the existing SNCF reports, remain valid primary
evidence for identified subsidiaries. GLEIF supplies the useful structured bulk
coverage here.

## Inclusion and amount rules

- Only active ultimate accounting-consolidation relationships with registration
  status `PUBLISHED` are accepted. Lapsed, inactive, future, ended, malformed,
  self-referential and conflicting parent relationships are excluded.
- Child and parent LEIs must identify active, public legal entities in Sirene.
  Active entity records with issued or lapsed LEI registrations can supply identity;
  a lapsed relationship never supplies a group link. Ambiguous identifiers are excluded.
- The ultimate parent must have a verified French SIREN. No fallback to a direct
  parent is used to infer an ultimate group. A parent with its own published
  ultimate parent is excluded as a group root.
- At least two existing `orgs` entries must belong to the group. Its displayed
  members are those organisations plus the verified parent. Existing SNCF members
  retain their report-based assignment. Every SIREN belongs to at most one group.
- The GLEIF perimeter is applied to 2025 amounts, the last completed calendar year.
  It does not reconstruct ownership when an earlier contract was signed. The date
  of the perimeter, the amount year and each relationship's last update are distinct.
- Existing contract shares split a contract between its holders before group sums.
  Group membership is unique. Purchases, contracts won and grants stay in separate
  columns. Internal group flows are not eliminated. Missing amounts remain missing.

## Coverage

The denominator is the public legal entities in `orgs`, including buyers and
opportunity-only organisations. A recipient has at least one recorded contract won
or State grant. LEI coverage means an exact identifier in the Golden Copy, including
historical registrations; 12,085 matched organisations also satisfy the identity
eligibility rules used for grouping.

| Scope | Organisations | Recipients | Groups |
|---|---:|---:|---:|
| Base | 214,047 | 192,987 | |
| Exact LEI match | 12,524 (5.85%) | 12,191 | |
| New GLEIF groups | 640 | 612 | 173 |
| GLEIF and preserved SNCF | 645 | 616 | 174 |

There are 717 displayed legal entities, including 72 verified group parents or
SNCF entities with no existing `orgs` entry. A further 30 ultimate-parent identifiers
connect 86 eligible organisations in groups of at least two. These parents have no
verified public Sirene identity in this mapping and are excluded from display.
Before this parent-identity restriction, there are 204 potentially useful ultimate
parent groups, including SNCF.

| 2025 amount, euros | Base | Exact LEI match | New GLEIF groups | Including SNCF |
|---|---:|---:|---:|---:|
| Contracts won | 188,222,387,348.11 | 64,785,330,980.55 | 18,114,140,180.13 | 18,116,628,532.53 |
| State grants in the associations annex | 10,497,612,295.38 | 2,771,224,559.24 | 1,107,199.31 | 1,107,199.31 |

LEI matches cover 34.42% of recorded 2025 contract amounts and 26.40% of this grant
source. Displayed groups cover 9.63% of contract amounts and 0.01055% of grants.
These categories are never added. Contracts are commitments or ceilings, not
observed cash payments. The grant source is not comprehensive business aid data.

## Spot checks

| Group | Displayed entities | Check |
|---|---:|---|
| Vinci | 52 | Aéroports de Lyon, SIREN 493425136, reports ultimate consolidation into Vinci. Vinci's 2025 consolidated statements also list full consolidation. A minority economic stake does not imply absence of accounting control. |
| Bouygues | 7 | Colas SA, SIREN 552025314, reports Bouygues as ultimate parent. Bouygues' Colas press release of 29 January 2026 confirms group membership. |
| EDF | 9 | Dalkia, SIREN 456500537, reports EDF as ultimate parent. EDF's release of 8 September 2026 identifies Dalkia as its subsidiary. |
| Orange | 8 | Globecast France, SIREN 440186740, reports Orange as ultimate parent. Orange's 25 March 2026 release describes a proposed disposal, with possible completion by year-end. The proposal is not treated as a completed disposal. |
| Caisse des Dépôts | 13 | La Poste, SIREN 356000000, reports CDC as ultimate parent. La Poste's own presentation confirms CDC's 66% holding. La Poste is therefore displayed within the CDC group. |
| SNCF | 12 | Existing report-based members and sources preserved, including Gares & Connexions through SNCF Réseau. |
| Thales | 0 | Its relevant French subsidiary links are lapsed, several last updated in 2020. They include entities subsequently carrying Safran names. They are excluded; a similar name cannot repair the evidence gap. |

## Validation

Focused tests cover the authority mapping, presentation spaces, legal-entity
category, aligned release timestamps, privacy, active status, contradictory
parents, relationship periods, duplicate evidence, preserved SNCF membership,
minimum useful group size and a shared contract counted once across two holders.

The complete pipeline build passed using DuckDB 1.5.6, without refresh. The first
attempt met a concurrent DGFiP cache-file rename; the completed cache checksum
matched its sidecar, and a subsequent cached run passed. No fetch or deployment
code was changed for this race.

The final SQLite passes `pragma quick_check`. It contains 174 groups and 717
members, no duplicated SIREN membership and no protected legal-category entries.
Every displayed group has at least two existing organisations. The sum of 2025
contracts won across group members equals the corresponding `org_years` sum
exactly in SQLite: 18,116,628,532.530216 euros.

Checks passed:

- Pipeline: Ruff formatting, Ruff lint, mypy and all 82 unittest tests.
- Site: `npm run check`, `npm run lint` and `npm run format:check`.
- Real rendered organisation pages for Vinci (552037806), La Poste within CDC
  (356000000), and SNCF (552049447), each at 1280 x 900 and 390 x 844 CSS pixels.
  Totals, provenance, collapsed defaults, the expanded member table and SNCF's
  Gares & Connexions evidence were checked. No horizontal page overflow at either
  width. The long CDC heading wraps on phones.

The temporary site used its own D1 state prepared from the isolated build through
`prepare-db`. The build directory and temporary files were removed after inspection.
No production runtime, deployment, remote Cloudflare state or user acceptance was
verified. Foreign parents and lapsed Thales relationships remain intentional
coverage gaps.

## Files owned by this change

- `pipeline/sources.toml`: three GLEIF inputs, CC0 and source-selection notes.
- `pipeline/schema.sql`: amount year and parent relationship type.
- `pipeline/src/chaque_euro/build.py`: GLEIF loader, download wording and nested SQL hashing.
- `pipeline/src/chaque_euro/gleif.py`: safe archive ingestion and matching release dates.
- `pipeline/src/chaque_euro/groups.py`: unique organisation-to-group validation.
- `pipeline/sql/inputs/gleif.sql`: exact identifiers and accounting-parent input fields.
- `pipeline/sql/38_organisation_groups.sql`: existing SNCF relationships and amount year.
- `pipeline/sql/40a_organisation_gleif_groups.sql`: documented eligible groups.
- `pipeline/sql/94_organisation_group_coverage.sql`: source coverage and snapshot dates.
- `pipeline/tests/test_gleif.py`: focused input, privacy, group and amount checks.
- `site/src/lib/data.ts`: typed relationships, evidence and separate amount year.
- `site/src/components/OrganisationGroup.astro`: visible totals, collapsed entities and evidence.
- `docs/groupes-verification.md`: source decision, coverage and validation evidence.
