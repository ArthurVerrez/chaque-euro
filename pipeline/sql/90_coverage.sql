create or replace table coverage as
select
    'decp' as source_id,
    (select count(*) from read_parquet(getvariable('decp_path'))) as rows,
    'Marchés notifiés du ' || strftime(min(notified_on), '%d/%m/%Y')
        || ' au ' || strftime(max(notified_on), '%d/%m/%Y') as coverage
from contract_rows
union all
select
    'sirene',
    (select count(*) from read_parquet(getvariable('sirene_path'))),
    'Stock des unités légales'
union all
select
    'ofgl-communes',
    count(*),
    'Exercices ' || min(year) || ' à ' || max(year) || ', ' || count(distinct insee) || ' communes'
from ofgl_rows
union all
select 'contours-departements', count(*), 'Découpage 2026, ' || count(*) || ' départements (métropole et outre-mer)'
from geo_departements
union all
select 'contours-communes', count(*), 'Découpage 2026, ' || count(*) || ' communes'
from geo_communes
union all
select
    'jaune-associations',
    (select count(*) from read_xlsx(getvariable('jaune_path'), header = true, all_varchar = true)),
    'Versements en ' || max(year) || ', ' || count(distinct siren) || ' SIREN distincts'
from grant_rows
union all
select
    'plrg-2025',
    (select count(*) from read_csv(getvariable('plrg_path'), delim = ';', header = true)),
    'Exécution 2025, ' || count(distinct programme_code) || ' programmes'
from plrg_programmes
union all
select
    'plrg-2025-recettes',
    (select count(*) from read_csv(getvariable('plrg_revenue_path'), delim = ';', header = true, all_varchar = true)),
    'Exécution 2025, ' || count(*) || ' rubriques de recettes'
from revenue
union all
select 'lfi-2026', count(*), 'Crédits votés pour 2026, ' || count(*) || ' missions'
from lfi_missions
union all
select 'insee-apu', count(*), 'Années ' || min(year) || ' à ' || max(year) || ', ' || count(distinct sector) || ' sous-secteurs'
from public_finances
union all
select 'insee-apu-fonctions', count(*), 'Années ' || min(year) || ' à ' || max(year) || ', ' || count(distinct function) || ' fonctions'
from public_functions
union all
select 'insee-apu-comptes', count(*), 'Années ' || min(year) || ' à ' || max(year) || ', ' || count(distinct sector) || ' administrations'
from public_accounts
union all select 'insee-deficit', count(*), 'Soldes 1949-2025, État disponible depuis 1959' from deficit_series
union all select 'insee-debt', count(*), 'Dette APU et État 1978-2025' from deficit_series where apu_debt is not null
union all select 'state-balance', count(*), 'Solde budgétaire hors FMI 2009-2025' from deficit_series where budget_balance is not null
union all select 'eu-budget', count(*), 'Flux France-UE 2000-2025, NGEU séparé' from eu_flows
union all select 'france-population', count(*), 'Population France au 1er janvier, milliers convertis en habitants' from france_population
union all select 'crc-paris', count(*), 'Comparaison 2023, périmètre CRC' from paris_comparison
union all select 'sdes-rail', count(*), 'Transferts hors retraites 2006-2024' from rail_transfers
union all select 'art-rail', count(*), 'Revenus par service, 2019 et 2022-2024, euros constants 2024' from rail_revenue
union all select 'rail-dividend', count(*), 'Fonds de concours SNCF, CP exécutés 2025' from sncf_fund
union all select 'sies-grants', count(*), 'Boursiers des rentrées 2012 à 2025, formations éligibles MESR' from student_scholarships
union all select 'student-cost', count(*), 'Compte de l’éducation 2024, données provisoires' from student_cost
union all select 'plf-2027', count(*), 'Proposition déposée, CP des programmes 150 et 231' from student_budget where stage = 'proposed'
union all select 'state-monthly', count(*), 'Exécution cumulée ' || min(year) || ' à ' || max(year) from state_monthly
union all select 'state-titles', count(*), 'Exécution 2025, titres du budget général' from state_titles
union all select 'state-ministries', count(*), 'Nomenclature et exécution 2025' from state_ministries
union all select 'state-assets', count(*), 'Bilan au 31 décembre ' || max(year) from state_assets
union all select 'insee-levies', count(*), 'Années ' || min(year) || ' à ' || max(year) from compulsory_levies
union all select 'eurostat-finances', count(*), 'Comptes annuels ' || min(year) || ' à ' || max(year) || ', dette trimestrielle séparée' from european_finances
union all select 'drees-protection', count(*), 'Prestations ' || min(year) || ' à ' || max(year) from social_benefits
union all select 'green-budget', count(*), 'Crédits proposés au PLF 2026' from green_budget;

insert into coverage
select source_id, count(*), 'Comptes par branche ' || min(year) || ' à ' || max(year)
    || ', résultats et prévisions distingués'
from social_branches group by source_id
union all select 'dss-ondam-2026', count(*), 'ONDAM 2024 constaté, 2025 prévu, 2026 proposé en octobre 2025' from social_ondam
union all select 'drees-sante-financeurs', count(*), 'Santé par financeur ' || min(year) || ' à ' || max(year) from health_payers
union all select 'drees-retraites', count(*), 'Retraites de droit direct ' || min(year) || ' à ' || max(year) || ', tous régimes' from pension_indicators
union all select 'cnaf-depenses', count(*), 'Prestations gérées par les caisses ' || min(year) || ' à ' || max(year) from family_benefits
union all select 'unedic-finances', count(*), 'Assurance chômage ' || min(year) || ' à ' || max(year) from unemployment_accounts;


insert into coverage
select 'boamp', count(*), 'Avis avec échéance future lors de la collecte' from procurement_notices
union all
select 'approch', count(*), 'Projets ouverts avec publication prévue à partir de la collecte'
from procurement_projects
union all
select 'competition-sanctions', count(*), 'Décisions de ' || min(year) || ' à ' || max(year)
from competition_decisions;

insert into coverage
select 'hatvp-agora', count(*), 'Personnes morales vérifiées, publications jusqu’au ' || getvariable('lobbying_as_of')::varchar from lobbying_organisations
union all select 'hatvp-defaults', count(*), 'Personnes morales de la liste officielle, état au téléchargement' from lobbying_defaults
union all select 'eu-transparency', count(*), 'Siège France, formes juridiques retenues, export ' || getvariable('eu_exported')::varchar from eu_lobbying
union all select 'cnccfp-parties', count(*), 'Exercices 2021 à 2024, comptes en euros uniquement, non consolidés' from party_accounts
union all select 'cnccfp-status', count(*), 'Privation d’aide expressément publiée, décisions exercice 2024' from party_aid_losses;


insert into coverage
select 'jorfsimple', count(*), '30 derniers journaux des livraisons récentes, après exclusions ; stock historique non reconstitué' from official_texts
union all select source_id, count(*), 'Dossiers non fusionnés entre producteurs ; étapes datées et liens documentaires' from legislative_files group by source_id
union all select source_id, count(*), 'Structures diffusables, sans annuaire de personnes' from administrations group by source_id;

insert into coverage select 'annuaire-competence', count(*), 'Relations commune-préfecture présentes dans les fiches intégrées ; hors catégories particulières de Paris' from administration_coverage;

insert into coverage
select 'ofgl-departements', count(*), 'Comptes 2018-2025, départements et collectivités particulières' from local_account_rows where level = 'departement'
union all select 'ofgl-regions', count(*), 'Comptes 2018-2025, régions et CTU' from local_account_rows where level = 'region'
union all select 'ofgl-epci', count(*), 'Comptes 2018-2025, groupements à fiscalité propre' from local_account_rows where level = 'epci'
union all select 'rei-2025', count(*), 'Fiscalité 2025, bases en euros, taux en pourcentage' from rei_rows
union all select 'ircom-2025', count(*), 'Revenus 2024 déclarés en 2025, cellules secrètes non reconstituées' from commune_income
union all select source_id, count(*), 'Participation, inscrits et votants, périmètre du scrutin' from commune_turnout group by source_id;

insert into coverage
select source_id, count(*), 'Identités publiques minimisées, mandats conservés séparément' from public_people group by source_id
union all select source_id,count(*),'Scrutins publics, positions nominatives disponibles' from public_ballots group by source_id
union all select source_id,count(*),'Comptes simplifiés publiés, pas tous les candidats' from campaign_accounts group by source_id
union all select 'cnccfp-mun2026',count(*),'Index des décisions publiées, couverture nationale partielle' from campaign_decisions
union all select 'hatvp-interests',count(*),'Déclarations d’intérêts actuellement livrées et rapprochées avec une identité officielle' from interest_declarations
union all select 'rne',sum(records),'Lignes de mandats ou fonctions, pas personnes uniques. Août 2026 ; AFE et consulaires mai 2026' from rne_statistics
union all select 'cada',count(*),'Avis et conseils, séances du ' || min(session_on) || ' au ' || max(session_on) from cada_opinions
union all select source_id,count(*),'Références datées, pas consommation individuelle' from expense_reference_values group by source_id
union all select 'cabinet-staff',sum(value),'Effectifs au 1er juillet 2025, PLF 2026' from cabinet_statistics;
