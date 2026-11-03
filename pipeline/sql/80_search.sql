create or replace table search as
select
    name,
    kind,
    siren as ref,
    coalesce(activity, '') as detail,
    won_amount + awarded_amount + grants_amount as weight
from orgs
union all
select
    name,
    'Commune',
    insee,
    department_name || ' (' || department_code || ')',
    population
from communes;
