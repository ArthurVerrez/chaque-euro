create or replace table rail_transfer_cells as
select row_number() over () as line, *
from read_xlsx(getvariable('sdes_rail_path'), sheet = '1.5-b', header = false, all_varchar = true, range = 'A1:U15', stop_at_empty = false);

create or replace table rail_transfers as
with years as (
    unpivot (select * exclude (A) from rail_transfer_cells where line = 3)
    on columns(* exclude (line)) into name col value year
), amounts as (
    unpivot (select * exclude (A) from rail_transfer_cells where line in (4, 8, 9, 10, 11, 15))
    on columns(* exclude (line)) into name col value amount
)
select y.year::integer as year,
    sum(a.amount::double * 1e6) filter (where a.line in (4, 8, 9, 10)) as operating,
    max(a.amount::double * 1e6) filter (where a.line = 11) as investment,
    max(a.amount::double * 1e6) filter (where a.line = 15) as total
from amounts a join years y using (col) group by year;

create or replace table rail_revenue as
select B::integer as year, E as service, F::double as commercial, G::double as public, H::double as total
from read_xlsx(getvariable('art_rail_path'), sheet = '8.1', header = false, all_varchar = true, range = 'A7:H26');

create or replace table rail_context as
select 'debt' as metric, year, -amount as amount
from state_balance_values where line = 57 and amount <> 0
union all
select 'reinvestment', 2025, amount from sncf_fund;

create or replace table rail_network_cells as
select row_number() over () as line, *
from read_xlsx(getvariable('sdes_rail_path'), sheet = '1.6-a', header = false, all_varchar = true, range = 'A1:Z13', stop_at_empty = false);

create or replace table rail_network as
with years as (
    unpivot (select * exclude (A) from rail_network_cells where line = 3)
    on columns(* exclude (line)) into name col value year
), amounts as (
    unpivot (select * exclude (A) from rail_network_cells where line in (4, 5, 8, 13))
    on columns(* exclude (line)) into name col value amount
)
select y.year::integer as year,
    max(a.amount::double * 1e6) filter (where a.line = 4) as eu,
    max(a.amount::double * 1e6) filter (where a.line = 5) as state,
    max(a.amount::double * 1e6) filter (where a.line = 8) as local_other,
    max(a.amount::double * 1e6) filter (where a.line = 13) as total
from amounts a join years y using (col) group by year;
