create or replace table public_accounts as
with labels as (
    select filename, line, trim(B) as label,
        first_value(regexp_extract(A, '\((S[0-9]+)\)', 1) ignore nulls)
            over (partition by filename order by line) as sector,
        last_value(case trim(B)
            when 'DEPENSES' then 'depenses'
            when 'RECETTES' then 'recettes'
            when 'SOLDES' then 'soldes'
        end ignore nulls) over (partition by filename order by line) as block
    from public_account_cells
),
years as (
    unpivot (select * exclude (A, B) from public_account_cells where line = 3)
    on columns(* exclude (filename, line)) into name col value year
),
amounts as (
    unpivot (select * exclude (A, B) from public_account_cells where line > 3)
    on columns(* exclude (filename, line)) into name col value amount
)
select l.sector, l.block,
    case when l.label in ('Total des dépenses', 'Total des recettes') then 'TOTAL'
        else regexp_extract(l.label, '\(([^()]+)\)\s*$', 1) end as code,
    l.label, y.year::integer as year, a.amount::double * 1e9 as amount
from amounts a
join labels l using (filename, line)
join years y using (filename, col)
where l.block is not null
    and (l.label in ('Total des dépenses', 'Total des recettes')
        or regexp_matches(l.label, '\(([^()]+)\)\s*$'))
    and not starts_with(l.label, 'dont')
    and not contains(l.label, 'hors éléments imputés');
