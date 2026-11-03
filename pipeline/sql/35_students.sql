create or replace table scholarship_cells as
select row_number() over () as line, *
from read_xlsx(getvariable('sies_grants_path'), sheet = 'Graphique 1', header = false, all_varchar = true, range = 'A1:O28', stop_at_empty = false);

create or replace table student_scholarships as
with years as (
    unpivot (select * exclude (A) from scholarship_cells where line = 26)
    on columns(* exclude (line)) into name col value year
), amounts as (
    unpivot (select * exclude (A) from scholarship_cells where line in (27, 28))
    on columns(* exclude (line)) into name col value value
)
select y.year::integer as year,
    max(a.value::integer) filter (where a.line = 27) as recipients,
    max(a.value::double / 100) filter (where a.line = 28) as share
from amounts a join years y using (col) group by year;

create or replace table scholarship_echelons as
select A as echelon, B::double as annual_amount, C::integer as recipients
from read_xlsx(getvariable('sies_grants_path'), sheet = 'Annexe 1', header = false, all_varchar = true, range = 'A5:C12');

create or replace table student_budget as
select 2025 as year, 'executed' as stage, programme_code as programme, spent as amount
from budget where programme_code in ('150', '231')
union all
select * from student_appropriations;

create or replace table student_cost as
select 'all' as metric, 2024 as year, try_cast(replace(regexp_extract(text, 'Supérieur1 : ([0-9 ]+) €', 1), ' ', '') as double) as amount from student_cost_page
union all
select 'university', 2024, try_cast(replace(regexp_extract(text, 'de ([0-9 ]+) euros par an pour un étudiant', 1), ' ', '') as double) from student_cost_page;
