create or replace table paris_comparison as
with extracted as (
    select
        regexp_extract(text, 'Population {2,}([0-9]+(?: [0-9]{3})*) {2,}([0-9]+(?: [0-9]{3})*) {2,}([0-9]+(?: [0-9]{3})*) {2,}([0-9]+(?: [0-9]{3})*) {2,}([0-9]+(?: [0-9]{3})*) {2,}([0-9]+(?: [0-9]{3})*)', ['p1', 'p2', 'm1', 'm2', 'l1', 'l2']) as population,
        regexp_extract(text, 'Dépenses de fonctionnement {2,}([0-9]+(?: [0-9]{3})*) {2,}([0-9]+(?: [0-9]{3})*) {2,}([0-9]+(?: [0-9]{3})*)\s*\n', 0) as totals,
        regexp_extract(text, 'Dépenses de fonctionnement/habitant {2,}([0-9]+(?: [0-9]{3})*) {2,}([0-9]+(?: [0-9]{3})*) {2,}([0-9]+(?: [0-9]{3})*)', ['paris', 'marseille', 'lyon']) as ratios
    from paris_annex
), cities as (
    select 'Paris' as city, 1 as position, population.p1 as population, ratios.paris as ratio, totals from extracted
    union all select 'Marseille', 2, population.m1, ratios.marseille, totals from extracted
    union all select 'Lyon', 3, population.l1, ratios.lyon, totals from extracted
)
select city, 2023 as year,
    try_cast(regexp_replace(population, '\s', '', 'g') as double) as population,
    try_cast(regexp_replace(ratio, '\s', '', 'g') as double) as per_capita,
    try_cast(regexp_replace(list_extract(regexp_extract_all(totals, '[0-9]+ [0-9]{3}'), position), ' ', '', 'g') as double) * 1e6 as spending
from cities;

create or replace table paris_context as
select 'equalisation' as metric, 2024 as year,
    try_cast(regexp_extract(text, 'en 2024, un montant de ([0-9]+) M€', 1) as double) * 1e6 as amount
from paris_report
union all
select 'fngir', 2024, try_cast(replace(regexp_extract(text, '(?s)Fonds national de garantie individuelle des\s+([0-9,]+)', 1), ',', '.') as double) * 1e6 from paris_report
union all
select 'daytime', 2023, try_cast(replace(regexp_extract(text, 'environ ([0-9,]+) millions', 1), ',', '.') as double) * 1e6 from paris_report
union all
select 'residents', 2023, try_cast(replace(regexp_extract(text, 'Aux ([0-9,]+) millions de Parisiens', 1), ',', '.') as double) * 1e6 from paris_report
union all
select 'police', 2024, try_cast(replace(regexp_extract(text, 'Budget spécial préfecture de police\s+[0-9,]+\s+[0-9,]+\s+[0-9,]+\s+([0-9,]+)', 1), ',', '.') as double) * 1e6 from paris_report
union all
select 'transport', 2024, try_cast(replace(regexp_extract(text, 'IDFM\s+[0-9,]+\s+[0-9,]+\s+[0-9,]+\s+([0-9,]+)', 1), ',', '.') as double) * 1e6 from paris_report;
