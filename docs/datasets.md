# Dataset inventory

Initially built on 31 October 2026, with grants, Sirene and household-count sections refreshed on 2 November 2026, by fetching each source (data.gouv.fr API, data.economie.gouv.fr and data.ofgl.fr Opendatasoft APIs, direct downloads). Sizes, row counts and quality figures below were measured on the files fetched that day unless a line says "not verified". The exact URLs fetched, timestamps and SHA-256 of each pipeline run are in `data/build/manifest.json` and on `/methodologie/manifest.json`.

## Summary

The national-money extension was verified on 2 November 2026. Its new source URLs are kept only in `pipeline/sources.toml`; the source IDs below identify the exact downloadable files.

| Dataset | Verdict | Used for |
|---|---|---|
| [Official documents and directories](#official-documents-and-directories) | Bounded pilot with explicit gaps | JO, appointments, legislative stages, ministries and prefectures |
| [HATVP AGORA and official defaults](#hatvp-agora-and-official-defaults) | Use now | Legal organisations, published activity sheets, budget ranges, institutions and exact SIREN cross-references |
| [EU Transparency Register](#eu-transparency-register) | Use now, conservative subset | French headquarters, recognised legal forms, annual declared costs and controlled interest areas |
| [CNCCFP party accounts and aid losses](#cnccfp-party-accounts-and-aid-losses) | Use now | Party resources 2021 to 2024, majority-public-aid indicator and explicit loss-of-aid decisions |
| [BOAMP](#boamp-and-approch) | Verified 2 November 2026 | Open notice deadlines and explicit buyer identifiers |
| [APProch](#boamp-and-approch) | Verified 2 November 2026 | Voluntary future purchasing plans |
| [Competition sanctions](#competition-sanctions-since-2009) | Verified 2 November 2026 | Initial financial sanctions, one total per decision |
| [DECP consolidées, format tabulaire](#decp-consolidées-format-tabulaire-colin-maudry) | Use now | Contracts won and awarded by organisation |
| [Sirene StockUniteLegale](#sirene-stockunitelegale) | Use now | November 2026 names, legal category, natural-person filter |
| [OFGL comptes consolidés des communes](#ofgl-comptes-consolidés-des-communes) | Use now | Commune spending per inhabitant vs peers |
| [Jaune associations, PLF 2027](#jaune-effort-financier-de-létat-en-faveur-des-associations) | Use now | State payments to associations (paid in 2025, includes services) |
| [PLRG 2025, annexe 1 CP](#plrg-2025-exécution-du-budget-de-létat) | Use now | State budget by mission and programme (spent in 2025) |
| [LFI 2026, état B](#lfi-2026-état-b) | Use now | Budget voted for 2026, by mission |
| [PLRG titles and ministries](#plrg-titles-and-ministries) | Use now | Executed 2025 spending by nature and ministry |
| [DGFiP State balance sheet](#dgfip-state-balance-sheet) | Use now | 2025 assets, liabilities and net position |
| [INSEE compulsory levies](#insee-compulsory-levies) | Use now | 2025 main taxes and beneficiary administrations |
| [Eurostat public finances](#eurostat-public-finances) | Use now | Annual comparison, COFOG and quarterly Maastricht debt |
| [DREES social protection](#drees-social-protection) | Use now | 2024 benefits by risk, broader than Sécurité sociale |
| [Source freshness](#source-freshness) | Use now | Data and retrieval dates, frequency-based status |
| [Insee comptes nationaux, tableau 3.215](#insee-comptes-nationaux-tableau-3215) | Use now | State, Sécurité sociale, local authorities and operators, spending and revenue since 1978 |
| [Insee comptes nationaux, tableaux 3.203 à 3.214](#insee-comptes-nationaux-tableaux-3203-à-3214) | Use now | Spending and revenue by nature for each public administration family and its components |
| [Insee comptes nationaux, tableau 3.307](#insee-comptes-nationaux-tableau-3307) | Use now | All public spending by purpose (health, pensions, schools…) and by who spends it, without double counting |
| [DSS REPSS Financement 2026](#dss-repss-financement-2026) | Later | Sécurité sociale by branch, licence unclear |
| [OFGL consolidated accounts by level](#ofgl-totals-by-level) | Use now | Accounts 2018-2025 by separate level |
| [Local taxes, income and turnout](#phase-2-local-money) | Use now | REI 2025, IRCOM 2025 and turnout by commune |
| [DGCL allocations 2026](#phase-2-local-money) | Publisher unavailable | CRPA reuse applies; no verified 2026 file obtained |
| [Elected officials, campaigns and expenses](#elected-officials-campaigns-and-public-expense-references) | Use with field exclusions | Public roles, votes, interests, campaigns and dated expense references |
| [Contours administratifs 2026](#contours-administratifs-2026) | Use now | Département map, commune maps, locator on commune pages |
| [Insee ménages 2023](#insee-nombre-de-ménages) | Use now | Per-household framing of the State budget |
| [PLF 2026 Budget vert](#plf-2026-budget-vert) | Use now | Proposed budget credits by environmental rating, own perimeter |
| [DECP official consolidation (MEF)](#decp-consolidation-officielle-mef) | Later | Audit baseline for DECP |
| [Jaune associations, data.gouv.fr page from the brief](#jaune-effort-financier-de-létat-en-faveur-des-associations) | Skip | Stale (2010 to 2012) |
| [DGFiP situation mensuelle de l'État](#dgfip-situations-mensuelles) | Use now | Cumulative execution through August 2026, compared with 2024 and 2025 |
| [SCDL subventions](#scdl-subventions) | Later | Local grants above 23 000 € |
| [Registre public des aides De Minimis](#registre-public-des-aides-de-minimis) | Later | Company aid since 2026 |
| [EU TAM State-aid register](#eu-tam-state-aid-transparency) | Later | Large company aid awards |
| [Data.Subvention](#datasubvention) | Skip | Restricted access |
| [recherche-entreprises API](#api-recherche-dentreprises) | Later | Spot checks only |
| [Insee populations légales](#insee-populations-légales) | Later | Population comes from OFGL for now |

## DECP consolidées, format tabulaire (Colin Maudry)

- Page: https://www.data.gouv.fr/datasets/donnees-essentielles-de-la-commande-publique-consolidees-format-tabulaire
- Stable file URL (redirects to the latest Parquet): https://www.data.gouv.fr/api/1/datasets/r/11cea8e8-df3e-4ed1-932b-781e2635e432
- File fetched: https://static.data.gouv.fr/resources/donnees-essentielles-de-la-commande-publique-consolidees-format-tabulaire/20261031-051826/decp.parquet, 255 254 660 bytes, published 31 Oct 2026 05:19 UTC. CSV variant: 2 631 206 921 bytes (resource list from the [data.gouv.fr API](https://www.data.gouv.fr/api/1/datasets/donnees-essentielles-de-la-commande-publique-consolidees-format-tabulaire/)).
- Schema: https://static.data.gouv.fr/resources/donnees-essentielles-de-la-commande-publique-consolidees-format-tabulaire/20261026-052045/schema.json. Code: https://github.com/ColinMaudry/decp-processing
- Rows: 3 361 764; 1 882 055 distinct `uid`; 2 155 911 rows flagged `donneesActuelles`. 68 columns.
- Columns that matter: `uid`, `acheteur_id` (SIRET), `titulaire_id` and `titulaire_typeIdentifiant`, `montant`, `montant_anomalie`, `dateNotification`, `objet`, `modification_id`, `donneesActuelles`, `sourceFile`.
- Years: notifications from 2018 to 2026; we keep 1 January 2019 to the retrieval date: 2 125 021 contract and holder rows, 1 854 467 contracts.
- Cadence: daily. Licence: [Licence Ouverte 2.0](https://www.data.gouv.fr/pages/legal/licences/etalab-2-0).
- Join keys: buyer SIRET (first 9 digits = SIREN), holder SIRET. `sourceFile` gives the upstream data.gouv.fr resource of each row, which we use as the record-level "Voir la source".
- Quality problems observed:
  - `montant` is the amount in the contract, often a ceiling for framework agreements. Summing raw current amounts gives 400 to 600 Md€ per year, well above total French public procurement.
  - Upstream anomaly flags on current rows since 2019: 6 885 contracts "aberrant", 28 179 "suspect". Before filtering, the 8 718 current rows flagged aberrant summed to 14 644 Md€.
  - Placeholder amounts that are not flagged: 83 IT services contracts of exactly 2 000 000 000 € from one buyer (Communauté urbaine de Dunkerque), 17 contracts of 999 999 999 €. We exclude amounts of 999 999 999 € or more from totals (112 contracts).
  - 64 441 contracts with no usable amount (missing or zero).
  - 131 735 contracts with several holders repeat the full amount on each holder row; we split equally.
  - `titulaire_typeIdentifiant` is inconsistent (`SIRET`, `Siret`, `siret`, `HORS_UE`, `HORS-UE`, `HORS UE`, 83 950 rows empty). 88 011 holder rows have no usable SIREN.
  - 2 622 duplicate (`uid`, holder) pairs among current rows; we keep the latest modification.
  - 982 rows have a notification date before the year 2000 (years such as 1 to 10) and 28 790 rows have none.
  - Publication threshold: contracts of 40 000 € HT or more, within two months of notification ([décret 2022-767](https://www.associatheque.fr/fr/fichiers/actualite/decret-2022-767-NOR-ECOM2200104D.pdf)).
- Verdict: use now.

## DECP consolidation officielle (MEF)

- Page: https://www.data.gouv.fr/datasets/donnees-essentielles-de-la-commande-publique-fichiers-consolides
- 42 JSON resources (monthly and yearly), for example `decp-2026.json` 670 125 635 bytes and `decp-global.json` 1 056 647 869 bytes ([API](https://www.data.gouv.fr/api/1/datasets/5cd57bf68b4c4179299eb0e9/)). Licence: fr-lo.
- Quality: the dataset metadata says temporal coverage 2018-10 to 2024-10 while files run to 2026-10.
- Verdict: later, as an audit baseline. The tabular consolidation above is easier to process and keeps per-row provenance.

## Sirene StockUniteLegale

- Page: https://www.data.gouv.fr/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret
- Stable file URL: https://www.data.gouv.fr/api/1/datasets/r/350182c9-148a-46e0-8389-76c2ec1374a3 (Parquet, 717 998 951 bytes, stock of 1 November 2026, fetched 2 November 2026).
- Rows: 30 280 224 legal units, 35 columns. 17 112 433 have `categorieJuridiqueUniteLegale` 1000 (entrepreneur individuel); 3 205 068 have `statutDiffusionUniteLegale` other than O (non-public diffusion; these identities are excluded).
- Columns that matter: `siren`, `denominationUniteLegale`, `denominationUsuelle1UniteLegale`, `categorieJuridiqueUniteLegale`, `statutDiffusionUniteLegale`, `etatAdministratifUniteLegale`.
- Cadence: monthly. Licence: Licence Ouverte 2.0. Join key: SIREN.
- October-stock baseline match rate (not remeasured for the November stock): of 157 017 holder SIRENs in DECP rows, 155 971 are in the stock, 14 833 are entrepreneurs individuels and 1 891 are partially diffusible.
- Quality: dataset metadata gives a temporal coverage ending 2023-12-31 although files are monthly and current.
- Verdict: use now. Rule applied in `pipeline/sql/30_identities.sql`: entrepreneurs individuels and non-diffusible units never get a name or SIREN on the site.

## OFGL comptes consolidés des communes

- Page: https://data.ofgl.fr/explore/dataset/ofgl-base-communes-consolidee/ (also listed on [data.gouv.fr](https://www.data.gouv.fr/datasets/comptes-consolides-des-communes-2018-2025)).
- API: https://data.ofgl.fr/api/explore/v2.1/catalog/datasets/ofgl-base-communes-consolidee/records
- Records: 13 535 660 (2018 to 2025, about 1.69 million per year), 41 fields, 49 aggregates. Modified 28 July 2026.
- Columns that matter: `exer`, `com_code` (code Insee), `com_name`, `dep_code`, `siren`, `tranche_population` (DGCL strata 0 to 10), `ptot`, `agregat`, `montant`.
- Fetched: 15 aggregates for 2018 to 2025, 816 API requests (2 November 2026), 34 875 communes.
- Coverage: 34 778 communes have 2025 staff costs against 34 932 for 2024, so 2025 is nearly complete.
- Cadence: annual. Licence: Licence Ouverte 2.0. Join keys: code Insee, SIREN of the commune (links to DECP buyers).
- Quality: the CSV and Parquet export endpoints returned HTTP 504 after 3 to 5 minutes, even filtered to one year and one aggregate. The grouped records API answers in about 3 seconds per département and year (limit 20 000 rows, checked against `total_count`).
- Communes nouvelles: before a merger, each former commune keeps its own rows under the current code Insee (1 522 aggregate groups in 2023 to 2025 alone). Amounts and populations must be added before dividing; adding per-inhabitant values overstates them.
- Verdict: use now, 2018 to 2025.

## Contours administratifs 2026

- Page: https://www.data.gouv.fr/datasets/contours-administratifs (organisation data.gouv.fr, annual update, last modified 26 October 2026 per the [API](https://www.data.gouv.fr/api/1/datasets/contours-administratifs/)).
- Files used (generalised to 100 m): départements https://contours-administratifs.s3.rbx.io.cloud.ovh.net/2026/geojson/departements-100m.geojson.gz (805 046 bytes, 109 features) and communes https://contours-administratifs.s3.rbx.io.cloud.ovh.net/2026/geojson/communes-100m.geojson.gz (8 237 354 bytes, 35 014 features).
- Properties: `code`, `nom`, `departement`, `region`, `epci`; arrondissements of Paris, Lyon and Marseille carry a `commune` property and are dropped. 1 000 m, 50 m and 5 m generalisations also exist.
- Coverage: the 101 départements and 34 875 communes of the OFGL accounts all have a shape. Collectivités d'outre-mer (975 to 989) are dropped.
- Licence: [ODbL](https://opendatacommons.org/licenses/odbl/1-0/), built from IGN Admin Express and OpenStreetMap. Maps must credit the source; a derived database published as such must stay under ODbL.
- Processing: `pipeline/src/chaque_euro/geo.py` projects to a flat plane, simplifies outlines (Douglas-Peucker) and writes SVG paths; overseas départements are drawn as insets on the France map.
- Verdict: use now.
## Jaune « Effort financier de l'État en faveur des associations »

- Updated 2 November 2026 to the PLF 2027 XLSX annex, published on 12 October 2026. The official page and direct file URL are registered in `pipeline/sources.toml`.
- The 15 035 399-byte workbook has 132 660 payments made in 2025, totalling 10 504 253 355.19 euros, and 57 540 distinct valid SIRENs. Its row count and total match the official report (132 660; 10 504.3 million euros after rounding).
- Previous file: PLF 2025, 112 722 payments made in 2023 (11.77 billion euros); 112 099 publishable rows after the Sirene privacy filter.
- Actual schema: 15 columns, including `Programme`, `SIREN`, `Montant`, `Objet 2025`, `Nomenclature juridique` and `Code adresse`. DR1's stated 14-column schema was wrong. DuckDB reads the workbook directly, with numeric amounts and normalised purpose whitespace. Negative correction payments are retained.
- This list includes grants, service payments and other payments. The report separates 94 808 grants (8 946.5 million euros), but the workbook has no payment-type field. We preserve the existing all-payment scope and now label the figures as payments, with this limitation on the site. Do not add this total to public contracts.
- Identity labels come only from the November Sirene stock. Category 1000 and non-public units are excluded from published grants, organisations and search; the national total retains all source rows.
- Licence Ouverte 2.0 confirmed from the budget.gouv.fr legal notice. The detailed workbook has no contrary rights notice.
- Direct curl requests returned an Incapsula challenge (HTTP 200, 212-byte HTML). The shared browser downloaded the actual official XLSX; it was copied into `data/raw/jaune-associations/` with the standard fetch sidecar and SHA-256. `fetch --only jaune-associations` reuses this verified cache. A future forced refresh may require the same browser fallback.
- The PLF 2026 fallback was also inspected. Its 27-column workbook total (11.731 billion euros) differs from its report (9.521 billion euros), so it was not used. PLF 2027 reconciles.
- Verdict: use now, PLF 2027 / payments in 2025. Programme labels still come from PLRG 2025; unknown programme codes stay visible without inventing a label.

## PLRG 2025, exécution du budget de l'État

- Page: https://www.data.gouv.fr/datasets/projet-de-loi-relatif-aux-resultats-de-la-gestion-et-portant-approbation-des-comptes-de-lannee-plrg-2025
- File used: https://data.economie.gouv.fr/api/v2/catalog/datasets/projet-de-loi-relatif-aux-resultats-de-la-gestion-et-portant-approbation-des-comptes-de-lannee-plrg-2025/attachments/annexe1_etat_cp_2025csv (34 516 bytes, published 22 April 2026).
- Rows: 177 (mission × programme × titre 2 or other titres), 33 missions, 129 programmes. Totals: LFI 2025 582.4 Md€, CP opened 591.5 Md€, spent 578.0 Md€.
- Columns: `Mission`, `Programme` (label and code), `Titre`, `LFI`, `Total_CP_Ouverts`, `Depenses_constatees`. Decimal comma, CRLF.
- Cadence: annual. Licence: Licence Ouverte 2.0. Join key: programme code (also used to label Jaune grants).
- Quality: dataset metadata says last update 17 April 2024 while 2025 resources were added in April 2026.
- Verdict: use now for 2025 execution. The voted 2026 budget comes from the [LFI 2026 text](#lfi-2026-état-b).
- Other years (checked 2 November 2026): PLR 2019 and 2020 exist as XLS on data.economie.gouv.fr ([2019](https://data.economie.gouv.fr/explore/dataset/projet-de-loi-de-reglement-2019-plr-20192/), [2020](https://data.economie.gouv.fr/explore/dataset/projet-de-loi-de-reglement-2020-plr-2020/)), [PLRG 2023](https://data.economie.gouv.fr/explore/dataset/projet-de-loi-relatif-aux-resultats-de-la-gestion-et-portant-approbation-des-comptes-de-lannee-plrg-2023/) and [PLRG 2024](https://data.economie.gouv.fr/explore/dataset/plrg-2024/) as CSV. 2021 and 2022 are only on budget.gouv.fr, which blocks scripted access. Mission names and perimeters change between years. The site's year-by-year view uses Insee national accounts instead.

## LFI 2026, état B

- Law n° 2026-103 of 19 February 2026 ([Direction du Budget](https://www.budget.gouv.fr/reperes/loi_de_finances/articles/loi-finances-2026)).
- Page: https://www.assemblee-nationale.fr/dyn/17/textes/l17t0227_texte-adopte-seance
- File used: https://www.assemblee-nationale.fr/dyn/opendata/PRJLANR5L17BTA0227.html (definitively adopted text, about 4 MB of HTML). Licence: [Licence Ouverte / Open Licence (Assemblée nationale)](https://data.assemblee-nationale.fr/licence-ouverte-open-licence).
- État B is the table after the heading "RÉPARTITION, PAR MISSION ET PROGRAMME, DES CRÉDITS DU BUDGET GÉNÉRAL": `Mission / Programme`, `Autorisations d'engagement`, `Crédits de paiement`. Missions are bold rows; programme and "Dont titre 2" rows are not. 32 missions, total CP 593 890 071 649 €, checked against the "Total" row by `pipeline/src/chaque_euro/lfi.py`.
- No CSV or JSON of the voted credits was found on data.economie.gouv.fr or data.gouv.fr on 2 November 2026. The PLF 2027 text (https://www.assemblee-nationale.fr/dyn/opendata/PRJLANR5L17B3210.html) repeats the LFI 2026 credits by programme.
- Mission names: 31 match 2025 exactly or up to case. "Anciens combattants, mémoire et liens avec la Nation" became "Monde combattant, mémoire et liens avec la Nation" (mapped in `27_budget_voted.sql`). "Plan de relance" has no credits in 2026.
- Verdict: use now.

## Insee comptes nationaux, tableau 3.215

- Page: https://www.insee.fr/fr/statistiques/8988845?sommaire=8988934 (base 2020, updated 28 August 2026).
- File used: https://www.insee.fr/fr/statistiques/fichier/8988845/t_3215_fr.xlsx (about 23 KB). Licence Ouverte 2.0.
- Spending and revenue, 1978 to 2025, for État (S13111), ODAC (S13112), APUL (S1313), ASSO (S1314) and all administrations publiques (S13). First block in Md€, second block in % of GDP (not used).
- 2025 spending: État 607.7, ODAC 142.3, APUL 335.5, ASSO 803.2, APU 1 714.1 Md€. Sub-sector totals keep transfers to other sub-sectors, so they sum to more than the APU total.
- Perimeter: the État here is not the budget général (607.7 against 578.0 Md€ in 2025). ASSO includes public hospitals, unemployment insurance and complementary pensions. 2025 is provisional.
- Verdict: use now.

## Insee comptes nationaux, tableaux 3.203 à 3.214

- Registry: `insee-apu-comptes`, eleven XLSX files from the 2025 national accounts campaign, Licence Ouverte 2.0. Source URLs and the definition reference are in `pipeline/sources.toml`.
- Table `public_accounts`: sector, block (spending, revenue, balances), national accounts code, original label, year, amount in euros. The parser preserves the block because codes occur on both sides. Subtotals and supplementary “dont” lines are excluded; alternative interest measure D41G is retained but never added to D41.
- Four family histories cover 1978–2025. Communes, départements, régions and syndicats cover 2019–2025; ODAL and the two social-insurance components cover 2013–2025.
- The build raises if any family/year spending or revenue total is missing or differs from table 3.215 by more than 0.05 billion euros, the half-unit rounding tolerance of that summary table.
- Family pages group nature codes in the site library. Fiscal transfers and uncollectible taxes adjust tax revenue; investment includes P51g and other net acquisitions of non-financial assets. The remaining expenditure includes subsidies, other transfers and taxes paid. A deficit is a financing need, not the observed volume of borrowing.
- Components transfer money to each other; their totals are not additive. “Syndicats” follows table 3.210; the social-insurance dependent-organism label follows table 3.214.
- ODAC is the national-accounts perimeter, distinct from the budgetary definition of state operators.
- Verdict: use now.

## Insee comptes nationaux, tableau 3.307

- Page: https://www.insee.fr/fr/statistiques/8574707 ("Les comptes de la Nation en 2024", published 27 March 2026).
- File used: https://www.insee.fr/fr/statistiques/fichier/8574707/T_3307.xlsx (about 52 KB). Licence Ouverte 2.0.
- Consolidated spending of all administrations publiques by COFOG function (10 divisions, with groups), split by sub-sector (État, ODAC, APUL, ASSO), 2009 to 2024, Md€. Sub-sector columns add up exactly to the APU total (1 671.8 Md€ in 2024). Table 3.215 comes from the newer campaign and gives 1 672.7 Md€ for 2024, so the two differ by under 0.1 %.
- Consolidated: a transfer between administrations counts once, at the one that spends it. The État share is therefore 469.2 Md€ in 2024, against 600.7 Md€ unconsolidated in table 3.215.
- 2025 by function is due in December 2026 (tables 3.301 to 3.307 of "Les comptes de la Nation en 2025"). Until then the site shows 2024 for this view and says so.
- Pipeline retains the ten COFOG divisions and their four-digit groups (for example GF1002, Vieillesse). The overview filters to divisions only; family pages show groups within their parent functions.
- Verdict: use now.

## DSS REPSS Financement 2026

- https://evaluation.securite-sociale.fr/home/financement.html. Workbook "PLACSS 2025, Annexe 1, REPSS Financement 2026, Données" (XLSX, 2 July 2026) has 2025 revenue, spending and balance by branch (maladie, vieillesse + FSV, famille, AT-MP, autonomie) and aggregate accounts since 2018.
- No open licence found; securite-sociale.fr legal notice has restrictive reuse wording. Some branch workbooks label M€ values as Md€, and the Autonomie history sheet repeats AT-MP figures.
- Verdict: later, once the licence is clarified.

## OFGL totals by level

- Consolidated datasets `ofgl-base-communes-consolidee`, `ofgl-base-gfp-consolidee`, `ofgl-base-departements-consolidee`, `ofgl-base-regions-consolidee` on https://data.ofgl.fr, aggregated by `exer` and `agregat` through the Explore API v2.1. 2025 "Dépenses totales hors remb": communes 119.2, EPCI 69.5, départements 91.9, régions 39.5 Md€.
- Levels cannot be added: transfers between them remain, Paris and the Métropole de Lyon appear in two levels, and 2025 misses 97 communes and 4 EPCI until the December update.
- Verdict: use now. Levels remain separate.

## PLF 2026 Budget vert

- https://data.economie.gouv.fr/explore/dataset/plf-2026-budget-vert/ (1 816 rows, published 13 November 2025, Licence Ouverte 2.0).
- Has PLF 2026 CP, LFI 2025 CP and 2024 execution at action and sub-action level.
- Quality: the perimeter differs from the official mission totals. LFI 2025 for "Enseignement scolaire" is 64.27 Md€ here against 88.64 Md€ in the PLRG file (pension contributions moved to a "Pensions" line), and it includes lines named `PSRCT`, `PSRUE` and `T3_CAS`.
- Now used on `/budget-etat`, source `green-budget`, SQL `27a_green_budget.sql`. The verified download has 1,816 rows. No PLF 2027 green-budget dataset was found in the official catalogue at verification time.
- Only `Crédits budgétaires` are summed, using the already allocated PLF 2026 amount. The rating weights are not applied again. Taxes assigned to third parties and tax expenditures are excluded.
- Favourable: 31.260961457 billion euros; unfavourable: 1.439830158; mixed: 0.384074804; neutral: 346.943708805; not rated: 99.488946630. These are credits proposed at the PLF stage, with the source's pension and revenue-transfer perimeter. They must not be reconciled directly with the voted or executed general budget.

## DGFiP situations mensuelles

- Situation mensuelle de l'État: https://www.data.gouv.fr/datasets/dgfip-situation-mensuelle-de-letat (CSV export, updated 30 October 2026). Aggregate in-year execution.
- Séries longues 2013 onwards: https://www.data.gouv.fr/datasets/jeux-de-donnees-des-situations-mensuelles-budgetaires-de-letat-des-exercices-2013-a-nos-jours-2. The "textes législatifs 2024-xx" file is UTF-16 with 60 aggregate lines (2024 and 2025 only).
- Now used on `/budget-etat`, source `state-monthly`, SQL `25a_state_monthly.sql`. The execution attachment has 26 information lines and 32 month columns (2024, 2025, January to August 2026). It is UTF-16, semicolon separated, with decimal commas, and may arrive gzip encoded. Values are euros, not millions.
- August 2026: net general-budget expenditure 313,364,933,689.30 euros; net general-budget revenue 224,863,110,362.91 euros; official budget balance −159,603,646,599.08 euros.
- Each month reconciles net revenue + dedicated funds − net expenditure − revenue transfers + special-account balance + annex-budget balance with the official balance, within one euro. Spending and revenue subcomponents also reconcile.
- Current-year execution remains labelled provisional and is compared with identical months in 2024 and 2025. The final PLRG 2025 tables retain their separate perimeter.

## Insee nombre de ménages

- RP 2023, published on the Couples-Familles-Ménages page on 2 November 2026. The source page and direct Parquet URL are registered in `pipeline/sources.toml`.
- Verified national row: `GEO_OBJECT=FRANCE`, `GEO=F`, `TIME_PERIOD=2023-01-01`, `RP_MEASURE=DWELLINGS`, `TPH=_T`, `PCS=_T`, `OCS=DW_MAIN`. Value: 31 274 741.28058 households, rounded to 31 274 741 in the registry (previously 30 907 000, RP 2022).
- Cross-check: the sum of the 34 858 commune rows in the accompanying `COM_2023` workbook is 31 274 741.28139, within 0.001 household of the national row. The workbook explicitly states France excluding Mayotte and geography at 1 January 2026.
- Use the complementary-exploitation dataset. The principal-exploitation file recommended by DR5 contains household population and people living alone, not a household count.
- Licence Ouverte 2.0 confirmed in the INSEE legal notice fetched on 2 November. The count remains a documented constant; no new model or parser is needed.
- Verdict: updated to RP 2023. Budget and public-finance amounts per household reuse this denominator; annual spending totals are unchanged.

## SCDL subventions

- Schema: https://schema.data.gouv.fr/scdl/subventions/
- 53 datasets on data.gouv.fr declare this schema ([API query](https://www.data.gouv.fr/api/1/datasets/?schema=scdl/subventions)); 547 datasets match the word "subventions". No consolidated national file was found.
- Verdict: later (harvest and validate per publisher).

## Registre public des aides De Minimis

- https://www.data.gouv.fr/datasets/registre-public-des-aides-de-minimis, data https://data.economie.gouv.fr/explore/dataset/aides_minimis/
- 22 373 aids, 236.5 M€ in total, granted 1 January to 28 October 2026, updated daily. Fields include `nom_beneficiaire`, `identifiant_beneficiaire` (SIREN), `montant_esb`, `instrument_aide`, `secteur_aide`, `autorite`.
- Quality: licence not specified on data.gouv.fr; some names are "-"; beneficiaries may include natural persons.
- Verdict: later, after clarifying the licence and applying the Sirene natural-person filter.

## EU TAM State-aid transparency

- Public search: https://webgate.ec.europa.eu/competition/transparency/public?lang=en (HTTP 200 on 31 October 2026).
- Bulk export format, French row counts and identifiers: not verified.
- Verdict: later.

## Data.Subvention

- https://www.data.gouv.fr/dataservices/api-data-subvention. Access is restricted to State, local government and operator agents through an api.gouv.fr request form, so it cannot feed a public site.
- Verdict: skip.

## API Recherche d'entreprises

- https://recherche-entreprises.api.gouv.fr. Not called during this run (rate limited; the Sirene stock covers bulk needs): not verified.
- Verdict: later, for spot checks.

## Insee populations légales

- Not ingested. Population on commune pages is the OFGL `ptot` field (population totale Insee retained by OFGL for the year). A cross-check against the Insee legal population file is not done: not verified.
- Verdict: later.

## Not covered this run

BOAMP, TED, EU FTS, Kohesio, PAC beneficiaries, HATVP, CNCCFP and Open DAMIR were not fetched.

## Analyses, verified 2 November 2026

All endpoints are registered in `pipeline/sources.toml`. Binary files were downloaded with
`curl -L`, opened, and retained under their source ID in `data/raw/`, with SHA-256 fetch sidecars.
Research reports are leads, never input tables.

| Source ID | Primary file and scope | Published tables |
|---|---|---|
| `insee-deficit` | Figures 1 and 2, base 2020, annual APU balance 1949-2025; State from 1959 | `deficit_series`, 77 years |
| `insee-debt` | Table 3.101, debt stock and GDP ratios 1978-2025 | 48 non-null debt years in `deficit_series` |
| `state-balance` | Table 3.107, budget execution excluding IMF transactions, 2009-2025; national-accounts bridge | 17 budget balances; SNCF debt takeovers in `rail_context` |
| `eu-budget` | Commission workbook, FR column, all 26 sheets 2000-2025; ordinary expenditure separated from NGEU | `eu_flows`, 26; `eu_headings`, 45 (nine headings, 2021-2025) |
| `france-population` | INSEE workbook, France on 1 January, thousands converted to people | Denominators for all 26 EU years |
| `crc-paris` | CRC 2025 PDF, annex 5 for 2023 comparison, table 16 and narrative for equalisation, table 25 for service contributions | `paris_comparison`, 3; `paris_context`, 6 |
| `sdes-rail` | Transport accounts 2024, A5.1-b (operator transfers) and A5.2-a (network investment subsidies) | `rail_transfers`, 19 years; `rail_network`, 24 years |
| `art-rail` | Figure 8.1, five passenger services, 2019 and 2022-2024, constant 2024 euros | `rail_revenue`, 20 |
| `rail-dividend` | Programme 203 execution report, financier table, SNCF 2025 CP contribution | `rail_context`, one reinvestment flow and two debt tranches |
| `sies-grants` | Graphique 1 and Annexe 1, OLAFE extraction 15 March 2026, eligible MESR formations | `student_scholarships`, 14 years |
| Existing `plrg-2025`, `lfi-2026`; new `plf-2027` | Programmes 150/231: executed CP 2025, enacted 2026 and proposed 2027, distinct stages | `student_budget`, 6 |
| `student-cost` | DEPP information note 25.52, provisional 2024 education account, all funders, apprentices included | `student_cost`, 2 |

`analyses.load` uses DuckDB's existing Excel extension, the standard-library HTML parser
patterns already used for LFI, and the installed `pdftotext` command (Poppler) for the CRC and
DEPP PDFs. Poppler must be installed on a machine rebuilding the pipeline. No downloaded
content is executed. Financial transformations live in SQL files 31 through 35. Annual
presidential bounds and event markers live in SQL 36; handover years, interim presidencies
and cohabitations cannot be attributed mechanically to an individual.

Reconciliations fail the build on changed coverage or mismatches: EU headings against totals
(to one euro), EU 2025 national contribution against French executed revenue (to one euro),
ART commercial plus public revenue against total, SDES network finance origins against total
(0.2 million euros for source rounding), operator transfers against their total (2 million),
SIES echelon counts against the published total, and CRC spending/population against published
ratios (one euro). Deficits are checked against 3.215. One verified source discrepancy is
explicit: 2024 total APU balance differs by 119.1 million euros between the dedicated deficit
series and 3.215. This precise gap is checked to one million; all other APU gaps use the same
one-million tolerance. State balances use the existing 50-million rounding tolerance. The
article uses the dedicated deficit series and discloses this difference.

Corrections to research leads: SIES counts 656,114 eligible scholarship recipients at rentrée
2025, not the Crous administrative count quoted in the report. The CRC cites 3.6 million
people present daily in the 2023 Apur diagnosis. Commission 2025 contributions including
customs and adjustments are 25,092,958,294.96 euros; ordinary French expenditure is
16,391,297,826.74 euros. Their accounting difference is -8,701,660,468.22 euros, or -126.38
euros per resident, and is distinct from the adjusted operating-balance estimates in the report.

Open coverage gap: Paris equalisation receipts were not verified after OFGL export timeouts.
The Paris article shows corrected payments and FNGIR separately, explicitly withholds a net
balance, and never treats unavailable receipts as zero. The 2023 CRC comparison is retained;
it is not labelled as a reconstructed 2025 comparison.

## PLRG titles and ministries

- Sources `state-titles` and `state-ministries`, SQL `25b_state_titles.sql`. Executed 2025 general-budget payment appropriations, including tax refunds. No PLF fallback was necessary.
- The titles attachment contains category lines, grouped into seven titles and programmes with expenditure. The ministry workbook maps programme codes to 2025 management ministries; the site shows 20 ministries or institutional groupings.
- Total: 578,038,661,317.33 euros. Personnel 156,182,829,225.88; intervention 271,407,373,127.47; debt charges 51,583,057,726.03. The largest grouping, Budget et comptes publics (160.194 billion euros), includes tax refunds, so it does not represent that ministry's operating costs.
- Every programme total reconciles with the existing executed PLRG CP file within one euro. Voted but unused programmes can be absent from the titles file only when their executed amount is zero. Missing ministry mappings raise an error.

## DGFiP State balance sheet

- Source `state-assets`, SQL `25c_state_assets.sql`. The structured balance API contains 2025. Its historical attached workbook still ends in 2024 and has an inconsistent unit label on its newest column; it is not used.
- The downloaded API export groups the 2025 balance by six accounting categories, in euros, using the publisher's signed `balance_sortie_2` field. Assets: 1,326,125,748,422.03 euros; liabilities: 3,442,015,173,566.04; net position: −2,115,889,425,144.01.
- Assets minus liabilities is checked against the published net-position accounts, adjusted for the year's expense and revenue accounts. The sign of the balance accounts is reversed to express the economic net position. Off-balance-sheet commitments are excluded. This is the State alone, not all public administrations or national wealth.

## INSEE compulsory levies

- Source `insee-levies`, files `beneficiaries.xlsx` (3.216) and `taxes.xlsx` (3.217), SQL `28_levies.sql`. Both latest columns are 2025, in billions of euros, converted to euros.
- Total levies in both tables: 1,305.067 billion euros. Beneficiaries: State 357.673; central agencies 21.105; local administrations 190.217; social-security administrations 733.209; EU institutions 2.863.
- Main taxes include VAT 208.821, CSG 156.583, personal income tax before credits 103.626, corporate income tax before credits 69.473 billion euros. Effective social contributions: 446.329 billion euros. The selected taxes are not exhaustive and are not added to the beneficiary chart.
- The central-administration subtotal is retained in downloads but excluded from the visible split. Checks reconcile beneficiaries with the total, the central split with its subtotal where available, and the total between tables 3.216 and 3.217. Before 1978, the State/agency split is unavailable; the central subtotal remains usable.

## Eurostat public finances

- Source `eurostat-finances`: four JSON-stat API files, `main`, `edp`, `functions`, `quarterly`. SQL `28_eurostat.sql`. Original status flags are retained. Eurostat has its own reuse policy, not the French Licence Ouverte.
- Sector S13 throughout. France, EU27, Germany, Italy, Spain and the Netherlands. Latest annual comparison: 2025. France: expenditure 57.3%, revenue 52.2%, deficit −5.1%, debt 115.7% of GDP. EU27: 49.4%, 46.3%, −3.1%, 81.5% respectively.
- COFOG function breakdown is available through 2024 only. Its separate date is shown; it is not presented as a 2025 breakdown. Ten division totals reconcile with annual expenditure within 0.61 GDP points (rounding of ten values published to one decimal). Revenue minus expenditure reconciles with the deficit within 0.21 GDP points.
- Latest French quarterly debt: 2026-Q2, 3,595,524,900,000 euros, 119.1% of trailing annual GDP, provisional flag `p`. The source publishes millions of euros and percent of GDP as separate units.
- Verification used `curl -L` against the exact registered API URLs. The local Python TLS chain failed for Eurostat; curl verified and downloaded the files, and fetch sidecars preserve timestamps and SHA-256. Full pipeline runs use those verified cached files. A forced fresh Python fetch still needs the local CA-chain issue resolved.

## DREES social protection

- Source `drees-protection`, sheet `prestations_1959_2024`, SQL `28_protection.sql`. The workbook downloaded in October 2026 explicitly calls 2024 semi-final and announces the next edition for December 2026.
- Source unit: millions of euros. Total benefits: 933.16053 billion euros. Six non-overlapping main risks: health 339.43864; old age/survivors 426.69885; family 65.47673; employment 51.30131; housing 16.05855; poverty and social exclusion 34.18645.
- The six risks reconcile with the published total for every available year, within 100,000 euros to allow historical rounding. The perimeter includes public and private schemes and employers, and is explicitly broader than the legal Sécurité sociale perimeter.

## Source freshness

- Each source carries a data date, retrieval date and declared frequency. Data dates are derived from ingested coverage in `91_source_dates.sql` where possible; fixed-vintage sources use the date declared in the registry. Undated documents are shown as undated.
- Thresholds live in `sources.toml`, never in pages. Daily: retrieve within 3 days, data within 14; monthly: 45 and 100; quarterly: 100 and 200; annual: 400 and 550. Occasional documents wait for a new edition without an artificial expiry.
- The site computes the status at read time: an overdue retrieval or missing data date means `à surveiller`; data beyond the frequency's age threshold means `en attente d’une nouvelle édition`; otherwise `à jour`. The label describes the imported source, not a claim that its publisher has released nothing newer.
- Complete data exports exist for all ten new result tables. Every figure links to its source and the stable calculation SQL.

## Comptes sociaux par branche et compléments (2 novembre 2026)

Les adresses officielles et les conditions de réutilisation sont dans `pipeline/sources.toml`.
Les publications DSS et CCSS sont réutilisées avec source et date sous le CRPA, articles L321-1 et L322-1.
Une absence de licence explicite sur le portail ne fait pas obstacle à cette réutilisation des informations publiques.

| Source | Données retenues | Table exportée | Lignes |
|---|---|---|---:|
| `ccss-octobre-2026` | Tableau 16 PDF, résultats 2022-2025, prévisions avant mesures 2026-2027, FSV séparé | `social_branches` | 46 |
| `dss-branches-2026` | Annexe 3 XLSX, onglet II.tab5, projet initial pour 2026 | `social_branches` | 6 |
| `dss-branches-2027` | Annexe 3 PDF, tableau 6, projet après mesures pour 2027 | `social_branches` | 6 |
| `dss-ondam-2026` | Annexe 5 XLSX, constat 2024, prévision 2025 et objectif proposé 2026 | `social_ondam` | 21 |
| `drees-sante-financeurs` | DCSi 2010-2025, cinq financeurs sans doublons et total publié | `health_payers` | 96 |
| `drees-retraites` | EACR de mai 2026, tous régimes 2004-2024, effectifs et pension brute de droit direct | `pension_indicators` | 63 |
| `cnaf-depenses` | Tous régimes, France entière, sélection de prestations 2013-2024 | `family_benefits` | 52 |
| `unedic-finances` | Recettes, dépenses, soldes et dette 2011-2025 | `unemployment_accounts` | 15 |
| `lfi-2026-jorf` | Loi n° 2026-103, JORF du 20 février 2026, référence citée avec le texte adopté | Référence | |

Les comptes LFSS des cinq branches, les administrations de sécurité sociale en comptabilité nationale,
les comptes thématiques DREES et les prestations gérées par les caisses CNAF ont des périmètres différents.
Ils ne sont ni additionnés ni présentés comme des totaux interchangeables. L'Unédic est hors des cinq branches.
Les pensions EACR comprennent les régimes complémentaires : la moyenne mensuelle et les effectifs de fin
d'année ne sont pas transformés en dépense annuelle.

Les tableaux PDF passent par `pdftotext -layout`. L'extraction impose le tableau attendu, ses années,
le nombre de colonnes et de cellules. Le pipeline contrôle les identités recettes moins dépenses égale solde,
la somme des soldes des cinq branches contre le solde total publié, puis l'ajout du FSV jusqu'en 2025.
Les recettes et dépenses totales sont les totaux consolidés publiés : les montants bruts des branches
incluent des transferts entre elles et ne sont pas additionnables. Le total avec FSV est contrôlé par son solde,
pas par une addition brute des charges et produits.

Les contrôles portent aussi sur la somme des financeurs de santé, les six sous-objectifs ONDAM,
les montants CNAF France entière contre métropole plus DOM, les composantes et soldes Unédic,
et les effectifs EACR par sexe contre le total tous régimes. Les tolérances reflètent les arrondis publiés :
1 M€ par identité CCSS et Unédic, 100 M€ pour les identités du tableau PLFSS 2027 publié au dixième de Md€,
3 M€ pour la somme des soldes CCSS, 300 M€ pour celle du PLFSS 2027, 350 M€ pour l'ONDAM.
Un écart supérieur, une valeur absente ou un jeu vide bloque le build.

Le téléchargement Python utilise le magasin de certificats du système via `truststore`. Si le serveur
refuse la négociation TLS de Python, le téléchargement de fichier passe par `curl`, avec vérification
TLS active et redirections limitées à HTTPS. L'empreinte SHA-256 et le sidecar sont conservés dans les deux cas.


## Procurement overview and publication quality

Sources: `decp`, `sirene`, `contours-departements`, `decp-publication-method` in the registry.
The consolidated dictionary explicitly defines `datePublicationDonnees` as publication of the
contract or amendment on data.gouv.fr. `dateNotification` also includes amendment notifications.
Contract attributes therefore use the latest version, while dating prefers an explicit initial
notification (`modification_id = 0`), falling back to the earliest known notification. This corrects organisation timelines as well as the new monthly overview.
Integrated output: 1,851,772 contracts, including 1,787,573 counted amounts totalling
1,590,745,473,224 euros HT, rounded to the nearest euro. The DECP snapshot was retrieved on 31 October 2026.
Flagged amounts use the publisher’s `montant_rationalise`, strictly positive and strictly below
999 999 999 euros. The declared amount and anomaly flag are retained. There are 6 874 counted
amounts labelled as consolidator estimates. Suspect amounts are unchanged in this source snapshot.
Contract values are selected together by amendment version, publication date and stable tie-breaks,
so duplicate current rows cannot change totals between identical runs. Real-file row hashes match
with one and four DuckDB threads. These contractual amounts, including framework ceilings, are not payments.
Each uid counts once nationally; multi-holder shares only affect organisation rankings.
The map locates the buyer, not the place of execution. Missing geography remains in national totals.

Publication quality only evaluates `modification_id = 0` with an initial amount of at least
40 000 euros HT, an elapsed two-calendar-month deadline, and no amount anomaly. The numerator
contains valid declared publication dates no later than that deadline; the denominator contains
valid dates between notification and retrieval. Missing and inconsistent dates are counted
separately. Contracts without an original version and unpublished contracts cannot be evaluated.
This is a descriptive indicator, not a legal compliance finding.

Tables: `procurement_breakdown`, `procurement_quality`, `procurement_latest`.
Automatic cross-checks reconcile count and amount across month, buyer department, procedure,
and contract type. Quality checks enforce on_time <= valid <= eligible <= total.
There are 103 year/category rows, 1 299 479 valid dates, 840 373 within two months (64.67%),
and 67 981 eligible initial contracts whose publication dates are unusable. The percentage
is conditional on published contracts with usable dates, not all procurement.

## BOAMP and APProch

Sources: `boamp` (DILA, Licence Ouverte, identifier `fr-lo`, as declared by data.gouv.fr) and `approch`
(DAE, Licence Ouverte 2.0, API metadata verified). Full exports were fetched and opened on
2 November 2026, with SHA-256 sidecars. BOAMP provides 7 621 notices with future response
deadlines at collection. APProch's export has 10 638 projects before the future/open filter.
The API export may be gzip-compressed despite its JSON filename; ingestion detects this.

Only BOAMP FNSimple identifiers explicitly typed SIREN/SIRET and French eForms ContractingParty references are resolved,
never contact, service-provider or supplier identifiers and never a buyer name match. A single
unambiguous SIREN is required. APProch includes a dedicated buyer SIREN field. Buyer names and
identifiers are published only for diffusible Sirene legal persons. Unidentified buyers use a
generic label. Personal contacts and full notice descriptions are excluded from output tables.
The 399 populated FNSimple estimate ranges retain both bounds, or their single open bound,
without averaging or adding them. Other estimate formats remain in the official notices.
The site hides expired deadlines at request time. BOAMP is a collected snapshot: subsequent
corrections and cancellations must be checked in the official notice. It counts notices, not
unique procurement procedures. Twenty upcoming records per section are shown.

APProch retains only `statut = Ouvert` and a projected publication date on or after collection;
undated or past plans are not represented as future purchases. Plans are voluntary, provisional,
non-exhaustive and non-binding. Historical past-dated plans are not treated as awarded contracts.
Verified output: 7 621 BOAMP notices, 5 260 with a public buyer SIREN; 3 512 future APProch
projects, 3 501 with a public buyer SIREN. BOAMP deadline errors exist in the source (one is in
year 7017): a future timestamp alone is not proof that a notice remains valid. The official
notice and its corrections remain decisive. Tables: `procurement_notices`, `procurement_projects`.

## Competition sanctions since 2009

Source: `competition-sanctions`, published by the Autorité de la concurrence under Licence
Ouverte 2.0. The CSV fetched on 2 November was published on 1 November 2026. It includes
initial sanctions before appeals, individual amounts and the repeated total for each decision.
The pipeline raises if a decision's totals disagree, and counts the total only once per decision.
Individual sanctions may be joint and several and are never summed to construct a decision total.

Names only appear when the denomination matches exactly one diffusible Sirene legal person,
normalising case, accents and punctuation but preserving corporate suffixes. Unmatched names
are replaced with a generic label, with no identifier. This deliberately sacrifices coverage to
avoid republishing natural persons or attributing a sanction to an ambiguous company. Matching
is not evidence that the organisation won a public contract. These sanctions cover all economic
activities and do not constitute a list of procurement exclusions. Tables: `competition_decisions`,
`competition_companies`. The twelve latest decisions appear on the overview.
Verified output: 189 decisions, 10 731 299 854 euros in initial sanctions, 2009-2026;
1 208 company rows, including 362 named rows matched to 318 distinct Sirene legal persons.
The other 846 rows keep their amounts and decision association, with generic labels.

## Single-bid indicator

Table `procurement_competition`, calculation `pipeline/sql/45_procurement_competition.sql`.
One uid per contract, initial notification from 2024, latest version of its bid count. Duplicate
holders count once. Positive bid counts must agree across retained holders; zero, missing,
negative or inconsistent counts are excluded from the rate and retained in coverage totals.
Buyer identities pass the same Sirene legal-person and diffusion filters as other public tables.

Integrated output: 155,243 single-bid contracts among 622,249 usable counts (24.95%), out of
738,861 published contracts (84.22% coverage). CPV sectors use the first two digits of the
procurement classification, not the supplier’s industry. The public table has 18 093 rows.
National buyer and sector sums are checked against the national denominator and numerator.
The site shows national and buyer indicators, ten high-coverage-volume buyers and twelve
high-coverage-volume CPV families; the full retained breakdown is downloadable. An offer count
is descriptive and does not establish an irregularity. Unpublished contracts are outside coverage.

## Procurement follow-up

Direct TED ingestion is deferred. BOAMP already contains French notices in European forms;
a separate TED source needs notice-version reconciliation and duplicate controls before adding
EU-wide coverage. Neither a complete EU catalogue nor definitive post-appeal sanctions is claimed.

## HATVP AGORA and official defaults

Verified on 2 November 2026. Sources `hatvp-agora` and `hatvp-defaults` in `pipeline/sources.toml`.

- Live ZIP downloaded through the pipeline: 14,300,724 bytes, 4,110 organisation records, 24,619 exercises and 113,474 activity sheets. Opened the ZIP and CSVs, checked schemas and relationships. The separate-views dataset is published by HATVP under Licence Ouverte / Open Licence.
- Published subset: 3,800 distinct legal organisations. SIREN organisations must be present in the local Sirene stock, have a category other than 1000 and open diffusion; RNA identifiers are accepted only with the official association category. Other identifiers and unverified legal status are excluded. One duplicate SIREN registration is merged, retaining exercise-to-registration mappings.
- Only organisation identity, structured exercise information, budget ranges and controlled institution/ministry categories are exported. No officers, employees, clients, addresses, websites or free-text activity descriptions.
- Activity charts count published sheets, not meetings or actions. The last 12 months are calculated from the file retrieval date. Quarter charts use publication dates explicitly. The ZIP contains exercises from 2018 to 2026, despite the portal description referring to the current year and five previous years. No claim of complete historical coverage is made.
- The source-announced exercise count differs from the available sheets for 33 retained exercises, by 68 sheets in total. Both counts and a reconciliation flag are exported. Charts use the available sheets; the build validates these counts against the exported activity table.
- The official website's JavaScript uses the third list in `stock.json` for defaults. The live JSON has 279 entries, of which 255 pass the legal-person filter. It is used directly, rather than inferring defaults from incomplete declarations. The JSON list does not display a separate licence; the registry identifies public-information reuse under CRPA L321-1, rather than inventing an explicit licence.
- Exact SIREN joins produce 1,133 organisations also present as procurement winners or State-payment recipients. Different time periods, contractual ceilings and equal allocation between co-holders are retained. This proves no causal link.

## EU Transparency Register

Verified on 2 November 2026. Source `eu-transparency` in `pipeline/sources.toml`.

- The catalogue's current XML URL failed certificate validation with the bundled Python trust store. The official Commission download endpoint worked with the local Homebrew CA bundle. TLS verification remained enabled.
- Live XML: 117,712,332 bytes, export timestamp 1 November 2026 at 21:00 UTC. The file declares 17,996 entries; the streaming parser checks exactly that count and raises on truncation. 1,693 entries have French headquarters.
- The EU catalogue distribution explicitly specifies `COM_REUSE`, the Commission reuse notice under Decision 2011/833/EU. It does not specify CC BY 4.0.
- The XML 1.1 contains control-character references unsupported by Python's XML 1.0 parser. Only these C0 references, excluding tab/newline/carriage return, are removed at the parsing boundary. A regression test verifies retained text, normal escaping and truncation rejection.
- Published subset: 1,441 recognised legal-person forms, with 12,935 controlled interest-area links. Independent/natural-person forms and ambiguous forms are excluded. The free-text legal-form field is used for filtering but never exported.
- Costs are only those in `closedYear/costs`, in euros. Ranges retain both bounds; an absent upper bound is open-ended. A missing cost is not replaced with total organisation budget, intermediary turnover or zero. Financial periods remain attached to each row.
- 280 conservative SIREN matches use an identical normalised organisation name, French country and uniqueness in both registries. No fuzzy matching, acronym matching or guessed identifier. Only SIRENs with an existing organisation page become links.

## CNCCFP party accounts and aid losses

Verified on 2 November 2026. Sources `cnccfp-parties`, `cnccfp-status` and `jorf-party-aid` in `pipeline/sources.toml`.

- Four live CSVs downloaded through the pipeline and opened: 519 accounts in the 2021 file, 551 in 2022, 535 in 2023 and 575 in 2024. The official catalogue publishes the accounts under Licence Ouverte / Open Licence. Latest exercise: 2024, publication 10 February 2026.
- 2,176 retained accounts: 518 for 2021, 551 for 2022, 532 for 2023 and 575 for 2024. Four exclusions are explicit: two 2023 accounts in XPF, one 2023 account with no currency, and code 671 in the 2021 file, which declares 2022 and conflicts with its separate 2022 account. No currency or exercise is guessed.
- Resources use the total products of the income statement. Membership contributions, elected officials' contributions, aggregated donations, the two public-aid fractions and other public aid remain separate. Other resources are the residual. Totals are non-consolidated between parties and can contain transfers counted in more than one account.
- Components are independently added and compared with the source total. Two 2024 accounts have discrepancies greater than one euro: LA DROITE SOCIALE (-2 euros) and RASSEMBLEMENT NATIONAL (+2 euros). Source amounts remain unchanged; both are excluded from majority-public-aid alerts. There are 25 retained 2024 accounts above the strict 50 percent threshold.
- The live official party list contains 803 entries. Its embedded JSON explicitly records three dates of loss of public aid. Only those entries are exported; a non-compliance flag or zero aid alone is insufficient. Codes AD and IC are preserved as official codes without guessing a legal interpretation. No explicit separate licence is displayed for the list; its registry entry cites public-information reuse under CRPA L321-1.
- The 2024 aid decree is linked as a legal reference, separately from party-account amounts. Its title, year and article 1 were verified in the official Legifrance search index; direct HTML access returned 403. No decree amounts are ingested or inferred from the accounts.
- Donors' and party officials' names are never imported. Named candidates, elected-official profiles, campaign accounts and all asset declarations are outside this phase.


## Official documents and directories

Phase 6 uses original publisher downloads only: `jorfsimple`, `dole`, `an-dossiers`, `senat-dosleg`, `roae`, `annuaire-etat`, `annuaire-competence`. Exact primary endpoints, licences and record templates are in `pipeline/sources.toml`.

JORFSIMPLE retains 30 editions from a rolling 50-day delivery window. Stock reconciliation is outstanding because full historical archives are out of scope. Totals count safe available XML, not TAR members. Protected acts are excluded before D1 and exports; bodies are not published. Appointment counts use an explicit title rule and count texts, not people. Names in nomination titles are limited to their public role under the updated naming rule.

DOLE is reconstructed from the latest stock and subsequent increments. Assembly law files exclude reports and petitions. Senate COPY blocks are parsed as data, never executed. Source identities and statuses remain separate. Future events are marked announced; missing dates stay unknown. Financial procedures identify budget files without equating a law with spending.

The directory uses ROAE plus prefecture/subprefecture API data, deduplicated by UUID. National relations remain multiple; geographic competence is separate from locations. No personal names, contacts or free text are exported from directories. The prefecture competence pivot does not cover Paris special categories. No historical ministry-budget mapping was inferred.


## Phase 2 local money

Verified on 2 November 2026. Exact primary URLs, download URLs and licences are registered only in `pipeline/sources.toml`; downloaded files and SHA-256 sidecars are under `data/raw/<source-id>/`. The verification metadata is under `data/research/p2/` (not versioned).

- `ofgl-departements`, `ofgl-regions`, `ofgl-epci`: OFGL consolidated accounts, fetched as filtered JSON exports and parsed in full. Metadata explicitly says Licence Ouverte v2.0. Exercises 2018-2025; amounts in euros, ratios in euros per total Insee inhabitant for the exercise. Principal budget plus annexes minus internal flows is checked per aggregate; operating plus investment is checked against spending. Levels are never added. Paris, Lyon métropole, Alsace, Corse, Martinique, Guyane and Mayotte retain their actual institutional scope. Four EPCI accounts are unavailable for 2025 according to OFGL. Historical EPCI accounts retain their accounting SIREN; there is no invented constant-boundary consolidation.
- `rei-2025`: licensed DGFiP raw archive linked from data.gouv.fr, preferred to the OFGL mirror. Opened the CSV, the 2025 explanatory PDF and the XLSX variable dictionary. CSV is CP1252, bases are euros, rates are percentages. Main communal, syndical and intercommunal shares of TFB, TFNB, CFE, TEOM and secondary-home TH are retained. CFE fiscal zones, TEOM zones and the TH surcharge are distinct. EPT identifiers are used for CFE in Grand Paris. TEOM beneficiary type follows F71; no organisation is inferred from EPCI membership. Other ancillary taxes and the TEOM incentive component are outside these rate tables. Medians use OFGL 2025 population strata, positive tax bases and matching recipient type and fiscal zone; no missing value is changed into zero.
- `ircom-2025`: DGFiP raw ZIP, Licence Ouverte 1.0. Opened the national commune XLSX: its header identifies income year 2024, declaration year 2025 and amounts in thousands of euros. Only published Total lines are retained, converted into euros. Fiscal department codes are normalized; municipal arrondissements are grouped into Paris, Lyon and Marseille. A secret cell prevents the corresponding grouped total from being disclosed. No suppressed value is reconstructed. Net tax can be negative after tax credits.
- `municipales-2026-t1`, `municipales-2026-t2`, `europeennes-2024`, `legislatives-2024-t1`, `legislatives-2024-t2`: Interior Ministry CSV files, Licence Ouverte v2.0. Opened and parsed all commune rows. Inscrits, votants, abstentions and the published participation percentage are reconciled. The impossible first-round 2026 record for commune 60400 (212 voters, 209 registered electors) is excluded and visibly flagged. The legislative second-round national file provides an independent totals check. Département turnout uses summed electors, not an average of commune percentages. Second-round figures cover only electors called to vote. No candidate names, list names, vote counts or political labels are exported.
- `dgcl-dotations-2026`: reusable under CRPA with source and date, regardless of the unspecified catalogue licence. Retry on 2 November 2026: the official HTTPS route timed out after 25 seconds; HTTP returned 503; the hostname without www did not resolve. The DGCL data.gouv catalogue still lists only 2016-2019 files. No 2026 amount is imported or inferred from another publisher. The source remains registered as a CRPA reference and commune pages explain the download gap beside the executed DGF history. An OFGL mirror was inspected for discovery, not ingested.

Added transformations: `51_local_accounts.sql`, `52_local_taxes.sql`, `53_local_income.sql`, `54_local_turnout.sql`. All generated tables are downloadable as CSV and Parquet. See the phase 2 and 5 integration record under `data/research/2026-11-02-parity/integration/`.

## Elected officials, campaigns and public expense references

Verified on 2 November 2026. All source and record URLs are in `pipeline/sources.toml`; the IDs below identify the original publishers, never an aggregator. Retrieval dates and SHA-256 are preserved in fetch sidecars and the build manifest.

- `an-members`, `an-history`, `an-votes`: active directory and XVIIe legislature history, organs, dated mandates, public ballots, nominal positions and separate correction intentions. Actor IDs retain their PA namespace. The historical directory prevents survivor bias in mandate-bounded participation.
- `senat-members`, `senat-votes`: Windows-1252 CSVs with comment preambles, native senator matricules and safely parsed DOSLEG COPY sections. No downloaded SQL is executed. Nominal ballots are bounded to the period since 8 July 2024; sessions and source delegation/status values remain distinct.
- Participation is computed by `47_public_votes.sql`, with whole covered legislature and trailing twelve-month windows. The numerator is explicit pour/contre/abstention; the AN denominator includes public ballots during exact mandate intervals; the Senate denominator comes from each ballot’s nominal roster. Non-votants are not participation, and a missing entry is not physical absence. No Datan majority score is displayed.
- `cnccfp-leg2024`, `cnccfp-eu2024`: 4,010 and 38 published accounts. Exact integer cents preserve missing values. Declared, retained and European continuation/rectification rows remain distinguishable. The actual workbook has 13 final AR and one final ARM, rather than 14 AR in the research summary; the importer preserves the workbook code. DD is exemption, ARR is reimbursement reduction, and RFE/FT are fixed reimbursements, not observed payments. The catalogue licence is unspecified; the factual reuse is attributed under CRPA L321-1 and L322-1, without inventing an open licence.
- `cnccfp-mun2026`: 26 enumerated portal pages, 1,274 initial and four rectifying documents. This is a partial national publication during the control process, not complete campaign accounts or a verified extraction of every PDF outcome. Official document links remain available.
- `hatvp-interests`, `hatvp-person`: 1,487 uniquely reconciled current interests declarations and 8,922 safe section summaries. An inventory candidate that cannot be uniquely reconciled is omitted. DSP, DSPM, DSPFM and unknown XML/inventory types cannot enter the public projection. Ministers' page links require an official AN cross-reference or an exact name and ministry match. Detailed activity strings and amounts remain at HATVP until a safe organisation/third-party projection is verified. Each refreshed build replaces the current public inventory, including downloads.
- `rne`: all twelve official category files, 617,082 mandate/function rows. August 2026 vintage except May 2026 AFE/consular files. These are not unique people. The public directory contains only 34,826 mayor rows and their public functions; age and sex are aggregate only. No birth date, profession, private contact, political nuance or name-only crosswalk is exported.
- `cada`: 60,938 unique Avis/Conseil dossiers, 1984-03-03 through 2024-04-18. The three Sanction rows, requester identities and all free text are excluded. Favourable and unfavourable flags may overlap; denominators are unique dossiers. A 2026 upload is not 2026 opinion coverage.
- `an-allowance`, `an-expense`, `senat-allowance`, `senat-expense`, `local-allowance`, `presidency-accounts`, `cabinet-staff`: 36 dated reference values and two staffing aggregates. Units, gross/net meaning, scope and document locator are explicit. The cabinet snapshot is 1 July 2025, PLF 2026, with 521 cabinet members and 2,220 support staff. Institution charges are separate from appropriations, allowances and authorised envelopes. Existing budget tables supply the Pouvoirs publics mission.
- `parliament-access`: the verified official rules and ordonnance support the access-limits block. The official June 2026 refusal letters and the associated 2025 judgment were not obtained in the verified corpus. The page does not convert a comparator's account into a verified official legal conclusion.

The public interfaces are in `site/src/lib/data.ts`. All eighteen new tables are exported in CSV and Parquet using the same public projections as D1. `test_public_roles.py` checks type/field exclusions, source withdrawal, CSV encoding and multiline records, safe COPY parsing, nullable exact money, European continuation rows, mandate gaps and exact minister identity/office matching. The public-role assessment and remaining publication formalities are in [phase-5-privacy.md](phase-5-privacy.md).
