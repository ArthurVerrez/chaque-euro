create or replace table constituency_composition as
select COMMUNE_RESID as insee,
    case when circo like '97%' then left(circo, 3) else left(circo, 2) end as department_code,
    right(circo, 2)::integer as constituency
from read_xlsx(getvariable('constituency_path'), sheet='table', all_varchar=true)
union
select DEPCOM, CODE_COM, right(circo, 2)::integer
from read_xlsx(getvariable('constituency_path'), sheet='table COM', all_varchar=true);

create or replace table commune_constituencies as
with passage_2021 as (
    select distinct old_insee, insee from commune_passage where year = 2021
), safe_passage as (
    select p.* from passage_2021 p
    join constituency_composition c on c.insee=p.old_insee
    qualify count(distinct p.insee) over (partition by old_insee)=1
        or count(distinct c.constituency) over (partition by old_insee)=1
), mapped as (
    select p.insee, c.department_code, c.constituency
    from safe_passage p join constituency_composition c on c.insee=p.old_insee
    union
    select c.* from constituency_composition c
    where not exists (select 1 from passage_2021 p where p.old_insee=c.insee)
)
select distinct m.*, 'commune-circonscriptions-2024' as source_id
from mapped m join communes c on c.insee=m.insee;

create or replace table mandate_constituencies as
select distinct r.*, m.source_id from mandate_constituencies_raw r
join public_mandates m on m.id=r.mandate_id;
