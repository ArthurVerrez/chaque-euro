create or replace table property_base_revaluation as
with november as (
    select cast(left(period, 4) as integer) as year, value from ipch_raw where period like '%-11'
)
select current.year + 1 as year, round(current.value / previous.value, 3) as coefficient
from november current
join november previous on previous.year = current.year - 1
where current.year >= 2017;
