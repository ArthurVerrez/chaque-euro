create or replace table public_organs as
select * from organs_raw union all select * from senate_organs;

create or replace table public_mandates as
select m.* replace (coalesce(m.ends_on, o.ends_on) as ends_on)
from (select * from mandates_raw union all select distinct * from senate_mandates) m
left join public_organs o on o.chamber = m.chamber and o.external_id = m.organ_id;

create or replace table public_people as
with people as (
    select * from people_raw union all select * from senate_people
), current_role as (
    select person_id,
        case when kind in ('MINISTERE','GOUVERNEMENT') then 'minister'
             when kind='ASSEMBLEE' then 'deputy' else 'senator' end as role_kind
    from public_mandates
    where kind in ('ASSEMBLEE','SENAT','MINISTERE','GOUVERNEMENT')
        and try_cast(starts_on as date) <= getvariable('democracy_as_of')::date
        and (ends_on is null or try_cast(ends_on as date) >= getvariable('democracy_as_of')::date)
    qualify row_number() over (partition by person_id order by
        case when kind in ('ASSEMBLEE','SENAT') then 0 else 1 end, starts_on desc)=1
), territory as (
    select person_id, territory_code, territory_label from public_mandates
    where territory_label is not null
    qualify row_number() over (partition by person_id order by starts_on desc)=1
), territory_codes as (
    select name, code from (
        select name_key(name) as name, code, 0 as priority from (values
            ('Iles Wallis et Futuna', '986'), ('Saint-Barthélemy', '977'), ('Saint-Martin', '978')
        ) t(name, code)
        union all
        select name_key(territory_label), territory_code, 1 from mandates_raw
        where kind = 'ASSEMBLEE' and territory_code is not null
        union all
        select name_key(name), code, 2 from department_labels_raw
    )
    qualify row_number() over (partition by name order by priority, code) = 1
), groups as (
    select m.person_id, o.label from public_mandates m
    join public_organs o on o.chamber=m.chamber and o.external_id=m.organ_id
    where m.kind='GP' and try_cast(m.starts_on as date) <= getvariable('democracy_as_of')::date
        and (m.ends_on is null or try_cast(m.ends_on as date) >= getvariable('democracy_as_of')::date)
    qualify row_number() over (partition by m.person_id order by m.starts_on desc)=1
)
select p.id, p.given_name, p.family_name, p.display_name,
    coalesce(r.role_kind,p.role_kind,'former') as role_kind, p.chamber,
    coalesce(t.territory_code, d.code, p.territory_code) as territory_code,
    coalesce(t.territory_label,p.territory_label) as territory_label,
    coalesce(g.label,p.group_label) as group_label,
    case when p.chamber='SENAT' then p.active else (r.person_id is not null)::integer end as active,
    p.hatvp_ref, p.source_id
from people p
left join current_role r on r.person_id=p.id
left join territory t on t.person_id=p.id
left join groups g on g.person_id=p.id
left join territory_codes d on p.chamber='SENAT' and d.name=name_key(p.territory_label);

create or replace table local_executives as select distinct * from local_executives_raw;
create or replace table rne_statistics as select * from rne_statistics_raw;
