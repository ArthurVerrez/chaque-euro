create or replace table approch_input as
select * from read_json_auto(getvariable('approch_path'), maximum_object_size = 33554432,
    compression = getvariable('approch_compression'));

create or replace table sanction_input as
select * from read_csv(getvariable('sanctions_path'), header = true);

create or replace table sanction_matches as
with names as (
    select distinct name_key(Entreprise) as name_key, Annee as year from sanction_input
)
select n.name_key, n.year, min(s.siren) as siren
from names n
join read_parquet(getvariable('sirene_path')) s
    on name_key(s.denominationUniteLegale) = n.name_key
where s.statutDiffusionUniteLegale = 'O'
    and s.categorieJuridiqueUniteLegale::varchar <> '1000'
    and coalesce(year(s.dateCreationUniteLegale), n.year) <= n.year
    and (s.etatAdministratifUniteLegale = 'A' or year(s.dateDebut) >= n.year)
group by n.name_key, n.year
having count(distinct s.siren) = 1;
