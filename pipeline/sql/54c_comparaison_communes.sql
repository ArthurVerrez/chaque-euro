create or replace table commune_spending_benchmarks as
with spending as (
    select f.insee, y.stratum, f.amount, y.population, f.per_capita
    from commune_finances f join commune_years y using (insee, year)
    where f.year = 2025 and f.item = 'depenses' and y.population > 0 and f.per_capita is not null
), cohorts as (
    select stratum as cohort, * from spending where stratum is not null
    union all select 'toutes', * from spending
    union all select 'grandes-hors-paris', * from spending where stratum = '10' and insee <> '75056'
), ranked as (
    select *, row_number() over (partition by cohort order by per_capita, insee) as position,
        count(*) over (partition by cohort) as size
    from cohorts
)
select cohort, count(*) as communes, median(per_capita) as median,
    avg(per_capita) as mean, sum(amount) / sum(population) as weighted,
    max(insee) filter (where position = (size + 1) // 2) as lower_insee,
    max(insee) filter (where position = (size + 2) // 2) as upper_insee
from ranked group by cohort;
