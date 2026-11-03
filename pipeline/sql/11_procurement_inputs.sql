create or replace table approch_input as
select * from read_json_auto(getvariable('approch_path'), maximum_object_size = 33554432,
    compression = getvariable('approch_compression'));

create or replace table sanction_input as
select * from read_csv(getvariable('sanctions_path'), header = true);

create or replace macro procurement_name(value) as
regexp_replace(upper(strip_accents(trim(value))), '[^A-Z0-9]', '', 'g');

create or replace table sanction_matches as
select procurement_name(s.denominationUniteLegale) as name_key, min(s.siren) as siren
from read_parquet(getvariable('sirene_path')) s
where s.statutDiffusionUniteLegale = 'O'
    and s.categorieJuridiqueUniteLegale::varchar <> '1000'
    and procurement_name(s.denominationUniteLegale) in (
        select procurement_name(Entreprise) from sanction_input
    )
group by name_key
having count(distinct siren) = 1;
