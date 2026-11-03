create or replace table ircom_rows as
select * from read_xlsx(getvariable('ircom_path'), header = false, all_varchar = true, range = 'A8:N300000')
where E = 'Total';

create or replace table commune_income as
with totals as (
    select left(B, 2) || lpad(C, 3, '0') as code,
        try_cast(F as bigint) as households,
        try_cast(I as bigint) as taxable_households,
        try_cast(G as double) * 1000 as reference_income,
        try_cast(H as double) * 1000 as net_tax
    from ircom_rows where E = 'Total'
), mapped as (
    select case
        when code between '75101' and '75120' then '75056'
        when code between '13201' and '13216' then '13055'
        when code between '69381' and '69389' then '69123'
        else code end as insee, * exclude (code)
    from totals
)
select insee, 2024 as revenue_year,
    case when count(households) = count(*) then sum(households)::bigint end as households,
    case when count(taxable_households) = count(*) then sum(taxable_households)::bigint end as taxable_households,
    case when count(reference_income) = count(*) then sum(reference_income) end as reference_income,
    case when count(net_tax) = count(*) then sum(net_tax) end as net_tax
from mapped group by all;
