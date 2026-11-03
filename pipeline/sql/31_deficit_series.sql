create or replace table deficit_cells as
select 'amount' as measure, row_number() over () as line, *
from read_xlsx(getvariable('insee_deficit_path'), sheet = 'Figure 1', header = false, all_varchar = true, range = 'A1:BZ20', stop_at_empty = false)
union all
select 'ratio', row_number() over (), *
from read_xlsx(getvariable('insee_deficit_path'), sheet = 'Figure 2', header = false, all_varchar = true, range = 'A1:BZ20', stop_at_empty = false);

create or replace table deficit_values as
with years as (
    unpivot (select * exclude (A) from deficit_cells where line = 4 and measure = 'amount')
    on columns(* exclude (measure, line)) into name col value year
), amounts as (
    unpivot (select * exclude (A) from deficit_cells where line in (6, 10))
    on columns(* exclude (measure, line)) into name col value value
)
select y.year::integer as year, a.line, a.measure, try_cast(a.value as double) as value
from amounts a join years y using (col);

create or replace table debt_cells as
select row_number() over () as line, *
from read_xlsx(getvariable('insee_debt_path'), sheet = 'T_3101', header = false, all_varchar = true, range = 'A1:AX25', stop_at_empty = false);

create or replace table debt_values as
with years as (
    unpivot (select * exclude (A, B) from debt_cells where line = 4)
    on columns(* exclude (line)) into name col value year
), amounts as (
    unpivot (select * exclude (A, B) from debt_cells where line in (7, 9, 15, 17))
    on columns(* exclude (line)) into name col value value
)
select y.year::integer as year, a.line, a.value::double as value
from amounts a join years y using (col);

create or replace table state_balance_cells as
select row_number() over () as line, *
from read_xlsx(getvariable('state_balance_path'), sheet = 'T_3107', header = false, all_varchar = true, range = 'A1:S75', stop_at_empty = false);

create or replace table state_balance_values as
with years as (
    unpivot (select * exclude (A, B) from state_balance_cells where line = 4)
    on columns(* exclude (line)) into name col value year
), amounts as (
    unpivot (select * exclude (A, B) from state_balance_cells where line in (5, 57, 66))
    on columns(* exclude (line)) into name col value value
)
select y.year::integer as year, a.line, try_cast(a.value as double) * 1e9 as amount
from amounts a join years y using (col);

create or replace table deficit_series as
with deficits as (
    select year,
        max(value * 1e9) filter (where line = 10 and measure = 'amount') as apu_balance,
        max(value / 100) filter (where line = 10 and measure = 'ratio') as apu_ratio,
        max(value * 1e9) filter (where line = 6 and measure = 'amount') as state_balance,
        max(value / 100) filter (where line = 6 and measure = 'ratio') as state_ratio
    from deficit_values group by year
), debts as (
    select year,
        max(value * 1e9) filter (where line = 7) as apu_debt,
        max(value / 100) filter (where line = 15) as apu_debt_ratio,
        max(value * 1e9) filter (where line = 9) as state_debt,
        max(value / 100) filter (where line = 17) as state_debt_ratio
    from debt_values group by year
), gdp_cells as (
    select row_number() over () as line, *
    from read_xlsx(getvariable('insee_apu_path'), header = false, all_varchar = true, range = 'A1:AX42', stop_at_empty = false)
), gdp_years as (
    unpivot (select * exclude (A, B) from gdp_cells where line = 3)
    on columns(* exclude (line)) into name col value year
), gdp_ratios as (
    unpivot (select * exclude (A, B) from gdp_cells where line = 39)
    on columns(* exclude (line)) into name col value ratio
), gdp as (
    select y.year::integer as year, f.spending / (r.ratio::double / 100) as gdp
    from gdp_years y join gdp_ratios r using (col)
    join public_finances f on f.year = y.year::integer and f.sector = 'S13'
)
select d.*, b.apu_debt, b.apu_debt_ratio, b.state_debt, b.state_debt_ratio,
    s.amount as budget_balance, s.amount / g.gdp as budget_ratio
from deficits d left join debts b using (year)
left join state_balance_values s on s.year = d.year and s.line = 5
left join gdp g on g.year = d.year;
