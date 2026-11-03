create or replace table revenue as
select
    Categorie as category,
    regexp_extract(Section, '^([0-9]+)', 1) as section_code,
    trim(regexp_replace(regexp_replace(Section, '^[0-9]+\.? ?-? ?', ''), '\*$', '')) as section,
    sum(coalesce(try_cast(replace(regexp_replace(replace(Total_des_recouvrements, chr(160), ''), '\s', '', 'g'), ',', '.') as double), 0)) as amount
from read_csv(getvariable('plrg_revenue_path'), delim = ';', header = true, all_varchar = true)
group by all
having amount <> 0;
