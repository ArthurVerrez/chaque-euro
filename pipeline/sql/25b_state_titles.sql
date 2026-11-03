create or replace table title_rows as
select regexp_extract(Programme, '(\d+)$', 1) as programme_code,
    Titre as title, replace(Depenses, ',', '.')::double as amount
from titles_raw;

create or replace table title_programmes as
select programme_code, sum(amount) as amount from title_rows group by programme_code;

create or replace table state_titles as
select 2025 as year, title as code,
    case title
        when 'Titre 1' then 'Dotations des pouvoirs publics'
        when 'Titre 2' then 'Personnel'
        when 'Titre 3' then 'Fonctionnement'
        when 'Titre 4' then 'Charges de la dette'
        when 'Titre 5' then 'Investissement'
        when 'Titre 6' then 'Intervention'
        when 'Titre 7' then 'Opérations financières'
    end as label, sum(amount) as amount
from title_rows group by title;

create or replace table ministry_codes as
select ltrim(Programme, '0') as programme_code, "Ministère" as ministry
from ministry_raw where Domaine='Budget Général';

create or replace table state_ministries as
select 2025 as year, m.ministry, sum(t.amount) as amount
from title_programmes t join ministry_codes m using (programme_code)
group by m.ministry;
