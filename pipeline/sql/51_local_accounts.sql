create or replace table local_account_rows as
with raw as (
    select 'departement' as level, dep_code as code, dep_name as name, * exclude (dep_code, dep_name)
    from read_json(getvariable('ofgl_departements_path'))
    union all by name
    select 'region' as level, reg_code as code, reg_name as name, * exclude (reg_code, reg_name)
    from read_json(getvariable('ofgl_regions_path'))
    union all by name
    select 'epci' as level, epci_code as code, epci_name as name, * exclude (epci_code, epci_name)
    from read_json(getvariable('ofgl_epci_path'))
)
select
    level, coalesce(nullif(code, 'NA'), siren) as code,
    coalesce(name, lbudg) as name, siren, coalesce(nat_juridique, categ) as category, exer::integer as year,
    ptot::bigint as population, f.item, montant as amount,
    montant_bp as principal, montant_ba as annexes, montant_flux as internal_flows,
    euros_par_habitant as source_per_capita
from raw join finance_items f on agregat = f.aggregate;

create or replace table local_accounts as
with totals as (select
    level, code, name, siren, category, year, population,
    max(amount) filter (where item = 'depenses') as spending,
    max(amount) filter (where item = 'fonctionnement') as operating,
    max(amount) filter (where item = 'investissement') as investment,
    max(amount) filter (where item = 'recettes') as revenue,
    max(amount) filter (where item = 'dette') as debt
from local_account_rows group by all)
select *,
    spending / nullif(population, 0) as spending_per_capita,
    revenue / nullif(population, 0) as revenue_per_capita,
    debt / nullif(population, 0) as debt_per_capita
from totals;

create or replace table commune_dgf_history as
select f.year, sum(f.amount) as amount, count(*) as communes
from commune_finances f where f.item = 'dgf' group by all;
