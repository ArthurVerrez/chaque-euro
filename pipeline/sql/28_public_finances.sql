create or replace table public_finances as
with cells as (
    select row_number() over () as line, *
    from read_xlsx(getvariable('insee_apu_path'), header = false, all_varchar = true, range = 'A1:CZ100', stop_at_empty = false)
),
euro_lines as (
    select line, trim(B) as label,
        last_value(
            case
                when trim(B) = 'Ensemble' then 'S13'
                else nullif(regexp_extract(B, '\((S[0-9]+)\)', 1), '')
            end ignore nulls
        ) over (order by line) as sector
    from cells
    where line > 3 and line < (select min(line) from cells where B like '%produit intérieur brut%')
),
years as (
    unpivot (select * exclude (A, B) from cells where line = 3)
    on columns(* exclude (line)) into name col value year
),
amounts as (
    unpivot (select * exclude (A, B) from cells where line > 3)
    on columns(* exclude (line)) into name col value amount
),
sectors (sector, name) as (
    values
        ('S13111', 'État'),
        ('S13112', 'Opérateurs de l''État'),
        ('S1313', 'Collectivités locales'),
        ('S1314', 'Sécurité sociale'),
        ('S13', 'Ensemble des administrations publiques')
)
select
    e.sector,
    s.name,
    y.year::integer as year,
    max(a.amount::double * 1e9) filter (where e.label = '-Dépenses') as spending,
    max(a.amount::double * 1e9) filter (where e.label = '-Recettes') as revenue
from amounts a
join euro_lines e using (line)
join years y using (col)
join sectors s using (sector)
where e.label in ('-Dépenses', '-Recettes')
group by all;
