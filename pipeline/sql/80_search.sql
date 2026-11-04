create or replace table search as
select
    name,
    kind,
    siren as ref,
    coalesce(activity::varchar, '') as detail,
    won_amount + awarded_amount + grants_amount as weight
from orgs
union all
select
    name,
    'Commune',
    insee,
    department_name || ' (' || department_code || ')',
    population
from communes
union all
select
    display_name,
    'Élu',
    id,
    concat_ws(' · ',
        case role_kind
            when 'deputy' then 'Député ou députée'
            when 'senator' then 'Sénateur ou sénatrice'
            when 'minister' then 'Membre du gouvernement'
            else 'Ancien mandat'
        end,
        territory_label,
        group_label
    ),
    active
from public_people
union all
select head_name, 'Responsable public', id,
    head_role || ' · ' || name_public, 2
from administrations where head_name is not null;
