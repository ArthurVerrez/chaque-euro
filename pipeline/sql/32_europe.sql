create or replace table eu_france as
with cells as (
    unpivot eu_cells on columns(* exclude (year, line)) into name col value value
), france as (
    select year, col from cells where trim(value) = 'FR'
    qualify row_number() over (partition by year order by line) = 1
)
select r.year, r.line, case when r.year < 2014 then coalesce(nullif(trim(r.D), ''), trim(r.C)) else coalesce(nullif(trim(r.B), ''), trim(r.A)) end as label,
    trim(r.A) as code, try_cast(c.value as double) * 1e6 as amount
from cells c join france f using (year, col) join eu_cells r using (year, line);

create or replace table eu_flows as
with flows as (
    select year,
        max(amount) filter (where upper(label) = 'TOTAL EXPENDITURE') as expenditure,
        max(amount) filter (where upper(label) = 'TOTAL OWN RESOURCES')
            + coalesce(max(amount) filter (where upper(label) = 'TOTAL BALANCES AND ADJUSTMENTS'), 0) as contribution,
        coalesce(max(amount) filter (where upper(label) = 'TOTAL NGEU'), 0) as ngeu,
        max(amount) filter (where label = 'Customs duties') as customs
    from eu_france group by year
)
select f.*, p.population, f.expenditure - f.contribution as balance,
    (f.expenditure - f.contribution) / p.population as per_capita
from flows f left join france_population p using (year);

create or replace table eu_headings as
select year, code, label, amount
from eu_france
where year >= 2021 and regexp_matches(code, '^([1-7]\.|O|S)$')
    and line < (select min(e.line) from eu_france e where e.year = eu_france.year and upper(e.label) = 'TOTAL EXPENDITURE');
