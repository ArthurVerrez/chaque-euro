create or replace table facts as
with latest_commune_year as (select max(year) as year from commune_finances)
select 'state_spent' as key, sum(spent) as value, '2025' as period, 'plrg-2025' as source_ids
from budget
union all
select 'state_spent_per_household', sum(spent) / getvariable('households'), '2025', 'plrg-2025,insee-menages'
from budget
union all
select 'contracts_count', count(*), max(year)::varchar, 'decp'
from buyer_contracts
where year = year(getvariable('decp_retrieved_on')) - 1
union all
select 'contracts_amount', sum(amount), max(year)::varchar, 'decp'
from buyer_contracts
where year = year(getvariable('decp_retrieved_on')) - 1 and counted
union all
select 'grants_amount', sum(amount), max(year)::varchar, 'jaune-associations'
from grant_rows
union all
select 'grants_associations', count(distinct siren), max(year)::varchar, 'jaune-associations'
from grant_rows
union all
select 'communes_median_spending_per_capita', median(per_capita), any_value(year)::varchar, 'ofgl-communes'
from commune_finances
where item = 'depenses' and year = (select year from latest_commune_year) and per_capita is not null
union all
select 'communes_spending', sum(amount), any_value(year)::varchar, 'ofgl-communes'
from commune_finances
where item = 'depenses' and year = (select year from latest_commune_year)
union all
select 'orgs_with_contracts', count(*), '2019', 'decp,sirene'
from orgs
where won_count > 0
union all
select 'buyers', count(*), '2019', 'decp,sirene'
from orgs
where awarded_count > 0;

create or replace table timeline as
select 'contracts_count' as series, year, count(*)::double as value
from buyer_contracts
where year between 2019 and year(getvariable('decp_retrieved_on'))
group by year
union all
select 'contracts_amount', year, sum(amount)
from buyer_contracts
where year between 2019 and year(getvariable('decp_retrieved_on')) and counted
group by year;
