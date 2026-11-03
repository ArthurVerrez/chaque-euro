insert into coverage
select 'commune-circonscriptions-2024', count(*),
    count(distinct insee) || ' communes, toutes les circonscriptions touchées'
from commune_constituencies
union all select 'insee-passage-2025', count(*), 'Codes communaux 2021 vers 2025' from commune_passage
union all select 'dgfip-fonctions-2025', count(*), count(distinct insee)
    || ' communes avec ventilation de fonctionnement, budget principal, 2025' from commune_functions;

insert into coverage_dates values
    ('commune-circonscriptions-2024', '2026-06-08'::date),
    ('insee-passage-2025', '2025-01-01'::date),
    ('dgfip-fonctions-2025', '2025-12-31'::date);
