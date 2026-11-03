create or replace table public_functions as
with cells as (
    select row_number() over () as line, *
    from read_xlsx(getvariable('insee_functions_path'), sheet = 'T_3307', header = false, all_varchar = true, range = 'A1:T600', stop_at_empty = false)
),
years as (
    unpivot (select * exclude (A, B, C, D) from cells where line = 4)
    on columns(* exclude (line)) into name col value year
),
amounts as (
    unpivot (
        select * exclude (B)
        from cells
        where A in ('S13', 'S13111', 'S13112', 'S1313', 'S1314') and regexp_matches(C, '^GF[0-9]{2}([0-9]{2})?$')
    )
    on columns(* exclude (line, A, C, D)) into name col value amount
)
select
    a.A as sector,
    a.C as function,
    regexp_replace(trim(a.D), '^[0-9.]+ - ', '') as name,
    y.year::integer as year,
    a.amount::double * 1e9 as spending
from amounts a
join years y using (col);
