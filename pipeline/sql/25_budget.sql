create or replace table plrg_programmes as
select
    Mission as mission,
    regexp_extract(Programme, ' - ([0-9A-Z]+)$', 1) as programme_code,
    regexp_replace(Programme, ' - [0-9A-Z]+$', '') as programme,
    sum(Depenses_constatees) as spent,
    coalesce(sum(Depenses_constatees) filter (where Titre like 'Titre 2%'), 0) as personnel,
    sum(LFI) as voted
from read_csv(getvariable('plrg_path'), delim = ';', header = true, decimal_separator = ',')
group by all;

create or replace table budget as
select * from plrg_programmes where spent <> 0 or voted <> 0;
