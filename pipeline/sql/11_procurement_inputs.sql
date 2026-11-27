create or replace table approch_input as
select * from read_json_auto(getvariable('approch_path'), maximum_object_size = 33554432,
    compression = getvariable('approch_compression'));

create or replace table sanction_input as
select * from read_csv(getvariable('sanctions_path'), header = true);

create or replace table sanction_matches as
with names as (
    select name_key(Entreprise) as name_key, Annee as year,
        bool_or(regexp_matches(upper(Entreprise),
            '\b(AG|GMBH|INC|LTD|LIMITED|LLC|PLC|CORP|CORPORATION|B\.?V|N\.?V|S\.?P\.?A|S\.?R\.?L)\b'))
            as foreign_form
    from sanction_input
    group by all
)
select n.name_key, n.year, min(s.siren) as siren
from names n
join read_parquet(getvariable('sirene_path')) s
    on name_key(s.denominationUniteLegale) = n.name_key
where s.statutDiffusionUniteLegale = 'O'
    and s.categorieJuridiqueUniteLegale::varchar <> '1000'
    and (s.categorieJuridiqueUniteLegale::varchar not like '3%' or n.foreign_form)
    and coalesce(year(s.dateCreationUniteLegale), n.year) <= n.year
    and (s.etatAdministratifUniteLegale = 'A' or year(s.dateDebut) >= n.year)
group by n.name_key, n.year
having count(distinct s.siren) = 1;
