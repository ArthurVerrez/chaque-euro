create or replace table departements as
with totals as (
    select
        c.department_code as code,
        any_value(c.department_name) as name,
        sum(y.population) as covered_population,
        sum(f.amount) as spending,
        y.year
    from communes c
    join commune_years y on y.insee = c.insee and y.year = (select max(year) from commune_years)
    join commune_finances f on f.insee = c.insee and f.year = y.year and f.item = 'depenses'
    group by c.department_code, y.year
),
populations as (
    select department_code as code, count(*) as communes, sum(population) as population
    from communes
    group by department_code
)
select
    t.code,
    t.name,
    p.communes,
    p.population,
    t.spending,
    t.spending / t.covered_population as per_capita,
    t.year,
    g.path,
    g.outline,
    g.viewbox,
    g.label_x,
    g.label_y,
    g.label_size
from totals t
join populations p using (code)
join geo_departements g using (code);

create or replace table commune_shapes as
select g.insee, g.path, g.cx, g.cy
from geo_communes g
join communes c using (insee);
