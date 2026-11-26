create or replace table commune_tax_rates as
with rates as (
    select coalesce(m.insee, h.code) as insee, h.year, h.commune, h.syndicate, h.grouping
    from (
        select trim(dep) || lpad(trim(com), case when length(trim(dep)) = 3 then 2 else 3 end, '0')
                as code,
            year, commune, syndicate, grouping
        from rei_rate_history
    ) h
    left join commune_code_map m on m.old_insee = h.code
    union all
    select insee, 2025, E12, E22, E32 from rei_rows
)
select insee, year,
    round(coalesce(rei_number(commune), 0), 2) as commune_rate,
    round(coalesce(rei_number(syndicate), 0), 2) as syndicate_rate,
    round(coalesce(rei_number(grouping), 0), 2) as grouping_rate
from rates
where rei_number(commune) > 0
qualify count(*) over (partition by insee, year) = 1;
