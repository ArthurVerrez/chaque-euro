# Sécurité sociale et provenance, vérification du 2 novembre 2026

Implémenté et vérifié localement. Aucun commit, aucune publication ni ressource distante créée.

## Périmètre livré

- Vue des cinq branches sur `/argent-public/securite-sociale`, année sélectionnable de 2022 à 2027. Par défaut : résultats 2025. Recettes, dépenses et solde par branche, barres de dépenses, total consolidé, FSV distinct.
- Projets PLFSS 2027 après mesures et PLFSS 2026 initial dans deux explications repliées. Ces versions ne sont pas présentées comme des comptes exécutés ou des budgets votés.
- Santé par financeur en 2025, objectif ONDAM du projet initial 2026, retraites EACR 2024, prestations gérées par les caisses CNAF 2024, assurance chômage Unédic 2011-2025 hors des cinq branches.
- Dates des données visibles dans toutes les lignes du composant Provenance lorsque la source dispose d'une date. Date de modification du fichier dans le détail de méthode lorsqu'elle est fournie par le serveur.
- Universalité budgétaire et non-affectation dans le lexique et près du graphique de l'État.
- Exemple réel DREES dans « Comment vérifier un chiffre » sur `/methodologie`.
- Loi publiée au JORF citée avec le texte adopté de l'Assemblée nationale pour le budget voté 2026.
- Téléchargement Eurostat avec magasin de certificats système. Repli natif `curl` vérifié pour les serveurs DSS qui refusent la négociation TLS de Python.

## Chiffres relus dans le build SQLite

Les liens primaires sont centralisés dans `pipeline/sources.toml` et repris dans les lignes de provenance du site.

| Cadre et année | Chiffres | Source primaire |
|---|---|---|
| Régimes de base, 2025, sans FSV | Recettes 643,774 Md€, dépenses 665,726 Md€, solde −21,952 Md€ | `ccss-octobre-2026`, tableau 16, page 40 |
| Régimes de base et FSV, 2025 | Recettes 644,461 Md€, dépenses 666,033 Md€, solde −21,572 Md€ | Même tableau |
| Projet 2027 après mesures | Recettes 683,7 Md€, dépenses 696,4 Md€, solde −12,7 Md€ | `dss-branches-2027`, tableau 6, page 14 |
| Santé DCSi, 2025 | 353,185484 Md€, dont 249,222645 Md€ financés par la Sécurité sociale | `drees-sante-financeurs`, poste `d00000` |
| Retraites, 2024 | 17 298 245 retraités de droit direct, pension brute moyenne de droit direct 1 646,9 € par mois | `drees-retraites`, EACR enrichie avec ANCETRE, A-Cadrage, tous régimes |
| Prestations légales directes gérées par les caisses, 2024 | 88,24506404 Md€ | `cnaf-depenses`, tous régimes France entière |
| Assurance chômage, 2025 | Recettes 45,370 Md€, dépenses 45,275 Md€, solde technique publié +96 M€ | `unedic-finances`, arrondis au million publiés |

La somme des soldes des cinq branches est rapprochée du total publié. Le total consolidé des recettes
et dépenses n'est pas une somme brute : les transferts entre branches sont éliminés par la DSS.
Les périmètres LFSS, Insee, DREES et CNAF ne sont pas additionnés.

## Données et contrôles

Neuf sources ajoutées, dont huit téléchargées et une référence JORF. Réutilisation DSS/CCSS : CRPA.
Six tables exportées en SQLite/D1, CSV zippé et Parquet :

- `social_branches` : 58 lignes (46 CCSS, 6 PLFSS 2026, 6 PLFSS 2027).
- `social_ondam` : 21 lignes.
- `health_payers` : 96 lignes.
- `pension_indicators` : 63 lignes.
- `family_benefits` : 52 lignes.
- `unemployment_accounts` : 15 lignes.

Les contrôles et tolérances sont décrits dans `docs/datasets.md`. Toute incohérence bloque le build.
Les tests couvrent les chiffres extraits, la période, les tableaux tronqués ou dupliqués, les chiffres
espacés des PDF, la conversion d'unité, les identités des branches et les totaux publiés, ainsi que
la vérification TLS et les métadonnées du téléchargement de repli.

## Fichiers de l'implémentation

Nouveaux : `pipeline/src/chaque_euro/social.py`, `pipeline/sql/28a_social_branches.sql`,
`28b_social_complements.sql`, `28c_social_ondam.sql`, `pipeline/tests/test_social.py`,
`test_fetch.py`, deux extraits officiels sous `pipeline/tests/fixtures/`,
`site/src/components/BranchAccounts.astro`, `SocialAccounts.astro`, ce document.

Partagés modifiés : `README.md`, `docs/datasets.md`, `pipeline/sources.toml`, `schema.sql`,
`pyproject.toml`, `uv.lock`, `src/chaque_euro/build.py`, `fetch.py`, `sql/90_coverage.sql`,
`91_source_dates.sql`, `site/src/lib/data.ts`, `glossary.ts`, `icons.ts`,
`components/Provenance.astro`, `pages/argent-public/[famille].astro`, `pages/budget-etat.astro`,
`pages/methodologie/index.astro`. Les captures des quatre pages modifiées sont rafraîchies.

## Validation effectuée

- Pipeline : Ruff format et lint, mypy, 13 tests unitaires réussis.
- `uv run chaque-euro run` complet : réussi, SQLite reconstruit, contrôles de cohérence réussis, exports et seed produits.
- `uv run chaque-euro fetch --only eurostat-finances --refresh` : réussi sur les quatre fichiers.
- Rafraîchissement des quatre publications DSS/CCSS par la commande de fetch : réussi, vérification TLS active, dates Last-Modified conservées.
- Site : Astro check, 0 erreur, 0 avertissement, 0 hint ; ESLint et Prettier réussis.
- D1 local : patch des métadonnées et six tables, relecture des lignes et dates, index `source_urls_source` recréé et relu.
- Chrome via Python Playwright : quatre pages à 390, 1180 et 1440 px, sans débordement horizontal ni erreur JavaScript. Sélecteur d'année et explications repliées exercés.

Captures dans `docs/screenshots/`, pour chaque largeur `390`, `1180`, `1440` :

- `argent-public-securite-sociale-<largeur>.png` et `argent-public-securite-sociale-details-<largeur>.png`.
- `securite-sociale-branches-<largeur>.png`.
- `budget-etat-<largeur>.png` et `budget-etat-non-affectation-<largeur>.png`.
- `methodologie-<largeur>.png` et `methodologie-verifier-<largeur>.png`.
- `lexique-<largeur>.png` et `lexique-non-affectation-<largeur>.png`.

Limite existante : les liens « Voir le calcul » ciblent le dépôt public configuré, encore inaccessible
sans authentification (404 constaté). La publication du code appartient à l'agent chargé de la revue
et de la publication. Aucun changement de visibilité ni envoi GitHub n'a été effectué ici.

Le serveur Astro a été arrêté après les captures (`astro dev status` : aucun serveur actif).
Les captures finales ont été inspectées, notamment le tableau des branches sur mobile et à 1180 px,
l'exemple de vérification sur mobile et l'explication de non-affectation à 1440 px.
