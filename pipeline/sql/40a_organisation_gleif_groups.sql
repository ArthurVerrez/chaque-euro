create or replace table gleif_units as
with identifiers as (
    select lei, siren
    from gleif_entity_input
    where entity_status = 'ACTIVE' and registration_status in ('ISSUED', 'LAPSED')
    qualify count(*) over (partition by siren) = 1
        and count(*) over (partition by lei) = 1
)
select i.lei, u.siren, u.denominationUniteLegale as name,
    u.categorieJuridiqueUniteLegale::varchar as legal_category,
    u.etatAdministratifUniteLegale = 'A' as active
from identifiers i
join read_parquet(getvariable('sirene_path')) u using (siren)
where u.statutDiffusionUniteLegale = 'O'
    and u.categorieJuridiqueUniteLegale::varchar <> '1000'
    and u.etatAdministratifUniteLegale = 'A'
    and nullif(nullif(u.denominationUniteLegale, ''), '[ND]') is not null;

create or replace table gleif_ultimate_links as
select distinct child_lei, parent_lei, updated_at
from gleif_relationship_input r
where relationship_status = 'ACTIVE' and registration_status = 'PUBLISHED'
    and child_lei <> parent_lei
    and try_cast(updated_at as date) <= getvariable('gleif_as_of')
    and not exists (
        select 1 from unnest(r.periods) p(period)
        where period.kind = 'RELATIONSHIP_PERIOD' and (
            (period.starts is not null and (
                try_cast(period.starts as date) is null
                or try_cast(period.starts as date) > getvariable('gleif_as_of')
            ))
            or (period.ends is not null and (
                try_cast(period.ends as date) is null
                or try_cast(period.ends as date) <= getvariable('gleif_as_of')
            ))
        )
    )
qualify count(distinct parent_lei) over (partition by child_lei) = 1
    and row_number() over (partition by child_lei order by updated_at desc) = 1;

create or replace table gleif_group_candidates as
select p.siren as group_siren, c.siren, c.name, c.legal_category, c.active,
    r.child_lei, r.parent_lei, r.updated_at
from gleif_ultimate_links r
join gleif_units c on c.lei = r.child_lei
join gleif_units p on p.lei = r.parent_lei
join orgs o on o.siren = c.siren
where not exists (select 1 from org_group_members m where m.siren in (c.siren, p.siren))
    and not exists (select 1 from gleif_ultimate_links a where a.child_lei = r.parent_lei);

insert into org_groups
select p.siren, 'Groupe ' || p.name, getvariable('gleif_as_of')::varchar, null,
    year(getvariable('gleif_as_of')) - 1
from gleif_group_candidates c
join gleif_units p on p.siren = c.group_siren
group by p.siren, p.name
having count(distinct c.siren) + (
    case when p.siren in (select siren from orgs) then 1 else 0 end
) >= 2;

insert into org_group_members
select c.group_siren, c.siren, c.name, org_kind(c.legal_category), c.legal_category,
    c.active, c.group_siren, 'gleif-relationships',
    'LEI ' || c.child_lei || ', mère ultime ' || c.parent_lei
        || ', mise à jour ' || left(c.updated_at, 10),
    'gleif-entities', c.child_lei, 'ultimate'
from gleif_group_candidates c
join org_groups g on g.siren = c.group_siren
union all
select distinct p.siren, p.siren, p.name, org_kind(p.legal_category), p.legal_category,
    p.active, null, 'gleif-entities', 'LEI ' || p.lei,
    'gleif-entities', p.lei, 'root'
from gleif_units p
join org_groups g on g.siren = p.siren
where g.analysis_path is null;
