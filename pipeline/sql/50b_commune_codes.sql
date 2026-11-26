create or replace table commune_passage as
select replace(year, 'CODGEO_', '')::integer as year, old_insee, CODGEO_2025 as insee
from (
    unpivot (
        select distinct CODGEO_2021, CODGEO_2022, CODGEO_2023, CODGEO_2024, CODGEO_2025
        from read_xlsx(getvariable('commune_passage_path'), sheet='COM', range='A6:AU40000',
            header=true, all_varchar=true)
        where NIVGEO='COM'
    )
    on CODGEO_2021, CODGEO_2022, CODGEO_2023, CODGEO_2024
    into name year value old_insee
);

create or replace table commune_code_map as
select old_insee, any_value(insee) as insee
from commune_passage
group by old_insee
having count(distinct insee) = 1;
