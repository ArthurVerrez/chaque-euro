create or replace table european_finances as
select m.geo, m.period::integer as year,
    max(m.amount) filter (where m.item='TE') as spending,
    max(m.amount) filter (where m.item='TR') as revenue,
    max(e.amount) filter (where e.item='B9') as balance,
    max(e.amount) filter (where e.item='GD') as debt,
    string_agg(distinct nullif(m.status || e.status, ''), ',') as status
from eurostat_raw m join eurostat_raw e on e.dataset='edp' and m.geo=e.geo
    and m.period=e.period and e.unit='PC_GDP'
where m.dataset='main' and m.unit='PC_GDP'
group by m.geo,m.period;

create or replace table european_functions as
select geo, period::integer as year, function, amount as spending, status
from eurostat_raw where dataset='functions' and length(function)=4 and function like 'GF%';

create or replace table quarterly_debt as
select period, max(amount) filter (where unit='MIO_EUR') * 1e6 as amount,
    max(amount) filter (where unit='PC_GDP') as ratio,
    string_agg(distinct nullif(status,''), ',') as status
from eurostat_raw where dataset='quarterly' group by period;
