create or replace table commune_function_labels as
select * from (values
    ('M57', '0', 'Services généraux', 10),
    ('M57', '1', 'Sécurité', 20),
    ('M57', '2', 'Enseignement et formation', 30),
    ('M57', '3', 'Culture, sport et jeunesse : autres services', 40),
    ('M57', '31', 'Culture', 41),
    ('M57', '32', 'Sport', 42),
    ('M57', '33', 'Jeunesse et loisirs', 43),
    ('M57', '34', 'Vie sociale et citoyenne', 44),
    ('M57', '4', 'Santé et action sociale', 50),
    ('M57', '5', 'Aménagement et logement', 60),
    ('M57', '6', 'Action économique', 70),
    ('M57', '7', 'Environnement', 80),
    ('M57', '8', 'Transports : autres services', 90),
    ('M57', '84', 'Voirie', 91),
    ('M57', '9', 'Fonction en réserve', 100),
    ('M14', '0', 'Services généraux', 10),
    ('M14', '1', 'Sécurité et salubrité publiques', 20),
    ('M14', '2', 'Enseignement et formation', 30),
    ('M14', '3', 'Culture', 40),
    ('M14', '4', 'Sport et jeunesse', 50),
    ('M14', '5', 'Santé et action sociale', 60),
    ('M14', '6', 'Famille', 70),
    ('M14', '7', 'Logement', 80),
    ('M14', '8', 'Aménagement, services urbains et environnement', 90),
    ('M14', '822', 'Voirie communale et routes', 91),
    ('M14', '9', 'Action économique', 100)
) as t(nomenclature, function_code, label, sort);

create or replace table commune_function_rows as
with normalized as (
    select exer::integer as year, ident, siren,
        case when starts_with(nomen, 'M57') then 'M57' else nomen end as nomenclature,
        case when starts_with(nomen, 'M57') and starts_with(fonction, '93')
            then nullif(substr(fonction, 3), '')
            when starts_with(nomen, 'M57') and regexp_matches(fonction, '^9[0-9]')
            then null else fonction end as function_code,
        obnetdeb::double as amount
    from read_csv(getvariable('commune_functions_path'), all_varchar=true)
    where cbudg='1' and (nomen in ('M14', 'M57', 'M57A')) and starts_with(compte, '6')
), labelled as (
    select r.*, l.function_code as service_code
    from normalized r left join lateral (
        select function_code from commune_function_labels l
        where l.nomenclature=r.nomenclature and starts_with(r.function_code,l.function_code)
        order by length(l.function_code) desc limit 1
    ) l on true
)
select * from labelled;

create or replace table commune_functions as
select c.insee, r.year, r.nomenclature,
    coalesce(r.service_code, 'unallocated') as function_code,
    sum(r.amount) as amount,
    sum(r.amount)/nullif(y.population,0) as per_capita
from commune_function_rows r
join communes c on c.siren=r.siren
join commune_years y on y.insee=c.insee and y.year=r.year
where exists (select 1 from commune_function_rows v where v.siren=r.siren
    and v.year=r.year and v.service_code is not null)
group by c.insee,r.year,r.nomenclature,r.service_code,y.population;

create or replace table commune_function_strata as
select y.stratum, f.year, f.nomenclature, f.function_code,
    case when count(*)>=5 then median(f.per_capita) end as median_per_capita,
    count(*) as communes
from commune_functions f join commune_years y using(insee,year)
where f.per_capita is not null
group by all;
