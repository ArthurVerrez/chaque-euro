create or replace table commune_postcodes as
with codes as (
    select distinct "#Code_commune_INSEE" as insee, Code_postal as postcode
    from read_csv(getvariable('postcodes_path'), delim=';', header=true, all_varchar=true,
        encoding='latin-1')
)
select distinct c.postcode, m.insee
from codes c
join communes m on m.insee = case
    when c.insee between '75101' and '75120' then '75056'
    when c.insee between '69381' and '69389' then '69123'
    when c.insee between '13201' and '13216' then '13055'
    else c.insee
end;
