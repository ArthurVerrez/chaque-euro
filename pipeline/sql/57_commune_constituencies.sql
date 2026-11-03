create or replace table constituency_composition as
select COMMUNE_RESID as insee, DEP as department_code, right(circo, 2)::integer as constituency
from read_xlsx(getvariable('constituency_path'), sheet='table', all_varchar=true)
union
select DEPCOM, CODE_COM, right(circo, 2)::integer
from read_xlsx(getvariable('constituency_path'), sheet='table COM', all_varchar=true);

create or replace table commune_passage as
select distinct CODGEO_2021 as old_insee, CODGEO_2025 as insee
from read_xlsx(getvariable('commune_passage_path'), sheet='COM', range='A6:AU40000',
    header=true, all_varchar=true)
where NIVGEO='COM';

create or replace table commune_constituencies as
with safe_passage as (
    select p.* from commune_passage p
    join constituency_composition c on c.insee=p.old_insee
    qualify count(distinct p.insee) over (partition by old_insee)=1
        or count(distinct c.constituency) over (partition by old_insee)=1
), mapped as (
    select p.insee, c.department_code, c.constituency
    from safe_passage p join constituency_composition c on c.insee=p.old_insee
    union
    select c.* from constituency_composition c
    where not exists (select 1 from commune_passage p where p.old_insee=c.insee)
)
select distinct m.*, 'commune-circonscriptions-2024' as source_id
from mapped m join communes c on c.insee=m.insee;

create or replace table mandate_constituencies as
select distinct r.*, m.source_id from mandate_constituencies_raw r
join public_mandates m on m.id=r.mandate_id;
