create or replace table social_ondam as
with selected as (
    select 2024 as year, 'Résultat, constat d’octobre 2025' as stage,
        case line when 5 then 'total' when 6 then 'ville' when 7 then 'hopitaux'
            when 9 then 'agees' when 10 then 'handicap' when 11 then 'fonds' when 12 then 'autres' end as code,
        line, 2 as label_col, 5 as amount_col, dataset
    from social_cells where dataset='ondam2024' and col=5 and line in (5,6,7,9,10,11,12)
    union all
    select 2025, 'Prévision du PLFSS 2026',
        case line when 5 then 'total' when 6 then 'ville' when 7 then 'hopitaux'
            when 9 then 'agees' when 10 then 'handicap' when 11 then 'fonds' when 12 then 'autres' end,
        line, 1, 3, dataset
    from social_cells where dataset='ondam2025' and col=3 and line in (5,6,7,9,10,11,12)
    union all
    select 2026, 'Objectif proposé dans le PLFSS 2026',
        case line when 4 then 'total' when 5 then 'ville' when 6 then 'hopitaux'
            when 8 then 'agees' when 9 then 'handicap' when 10 then 'fonds' when 11 then 'autres' end,
        line, 1, 4, dataset
    from social_cells where dataset='ondam2026' and col=4 and line in (4,5,6,8,9,10,11)
)
select s.year, s.stage, s.code, trim(l.value) as label, a.value::double * 1e9 as amount
from selected s join social_cells l on l.dataset=s.dataset and l.line=s.line and l.col=s.label_col
join social_cells a on a.dataset=s.dataset and a.line=s.line and a.col=s.amount_col;
