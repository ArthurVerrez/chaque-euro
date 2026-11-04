create or replace table org_group_units as
select
    siren,
    denominationUniteLegale as name,
    categorieJuridiqueUniteLegale::varchar as legal_category,
    etatAdministratifUniteLegale = 'A' as active
from read_parquet(getvariable('sirene_path'))
where siren in (select siren from organisation_group_input)
    and statutDiffusionUniteLegale = 'O'
    and categorieJuridiqueUniteLegale::varchar <> '1000'
    and nullif(nullif(denominationUniteLegale, ''), '[ND]') is not null;

create or replace table org_groups as
select distinct
    i.group_siren as siren,
    'Groupe SNCF' as name,
    i.as_of::varchar as as_of,
    '/analyses/rail' as analysis_path,
    year(i.as_of) as amount_year
from organisation_group_input i
join org_group_units u on u.siren = i.group_siren
where i.parent_siren is null;

create or replace table org_group_members as
with recursive members as (
    select i.*
    from organisation_group_input i
    join org_groups g on g.siren = i.group_siren
    join org_group_units u on u.siren = i.siren
    where i.parent_siren is null
    union all
    select i.*
    from organisation_group_input i
    join members p on p.siren = i.parent_siren
        and p.group_siren = i.group_siren and p.as_of = i.as_of
    join org_group_units u on u.siren = i.siren
    where i.siren <> i.group_siren
)
select
    m.group_siren,
    m.siren,
    u.name,
    org_kind(u.legal_category) as kind,
    u.legal_category,
    u.active,
    m.parent_siren,
    m.source_id,
    m.source_ref,
    m.identifier_source_id,
    m.identifier_ref,
    case when m.parent_siren is null then 'root' else 'direct' end as parent_kind
from members m
join org_group_units u on u.siren = m.siren;
