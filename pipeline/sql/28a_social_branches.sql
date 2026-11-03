create or replace table social_branches as
with observations as (
    select source_id, year, branch, metric, amount from social_pdf
    union all
    select 'dss-branches-2026', 2026,
        case col when 3 then 'maladie' when 4 then 'vieillesse' when 5 then 'famille'
            when 6 then 'atmp' when 7 then 'autonomie' when 8 then 'total' end,
        case line when 5 then 'Dépenses' when 18 then 'Recettes' when 39 then 'Solde' end,
        value::double
    from social_cells where dataset='branches' and line in (5,18,39) and col between 3 and 8
)
select source_id, year, branch,
    case branch when 'maladie' then 'Maladie' when 'vieillesse' then 'Vieillesse'
        when 'famille' then 'Famille' when 'atmp' then 'Accidents du travail et maladies professionnelles'
        when 'autonomie' then 'Autonomie' when 'total' then 'Régimes de base, total consolidé'
        when 'fsv' then 'Fonds de solidarité vieillesse'
        when 'total_fsv' then 'Régimes de base et FSV, total consolidé' end as label,
    case when source_id='ccss-octobre-2026' and year<=2025 then 'Résultat'
        when source_id='ccss-octobre-2026' then 'Prévision avant mesures'
        else 'Projet de loi, après mesures' end as stage,
    max(amount) filter (where metric='Recettes') * 1e6 as revenue,
    max(amount) filter (where metric='Dépenses') * 1e6 as spending,
    max(amount) filter (where metric='Solde') * 1e6 as balance
from observations group by source_id,year,branch;
