create or replace table commune_tax_rates as
with rates as (
    select trim(dep) || lpad(trim(com), case when length(trim(dep)) = 3 then 2 else 3 end, '0')
            as insee,
        year, commune, syndicate, grouping
    from rei_rate_history
    union all
    select insee, 2025, E12, E22, E32 from rei_rows
)
select insee, year,
    round(coalesce(rei_number(commune), 0), 2) as commune_rate,
    round(coalesce(rei_number(syndicate), 0), 2) as syndicate_rate,
    round(coalesce(rei_number(grouping), 0), 2) as grouping_rate
from rates
where rei_number(commune) > 0;
