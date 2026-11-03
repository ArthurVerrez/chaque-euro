create or replace table procurement_base as
with dates as (
    select uid, min(notified_on) as notified_on from contract_rows group by uid
), attributes as (
    select r.uid,
        first(struct_pack(acheteur_departement_code, procedure, type)
            order by modification_id desc, datePublicationDonnees desc nulls last,
                titulaire_id nulls last, sourceFile, acheteur_departement_code,
                procedure, type) as details
    from read_parquet(getvariable('decp_path')) r
    where r.donneesActuelles
    group by r.uid
)
select a.uid, d.notified_on,
    case when a.counted then a.amount else 0 end as amount,
    a.counted, a.amount_estimated, b.details.acheteur_departement_code as department,
    b.details.procedure as procedure, b.details.type as type
from contract_amounts a
join dates d using (uid)
join attributes b using (uid)
where d.notified_on between date '2019-01-01' and getvariable('decp_retrieved_on');

create or replace table procurement_breakdown as
select 'month' as dimension, strftime(notified_on, '%Y-%m') as label,
    count(*) as count, count(*) filter (where counted) as priced, sum(amount) as amount,
    count(*) filter (where counted and amount_estimated) as estimated
from procurement_base group by label
union all
select 'department', coalesce(department, 'Non localisé'), count(*),
    count(*) filter (where counted), sum(amount),
    count(*) filter (where counted and amount_estimated)
from procurement_base group by department
union all
select 'procedure', coalesce(procedure, 'Non renseignée'), count(*),
    count(*) filter (where counted), sum(amount),
    count(*) filter (where counted and amount_estimated)
from procurement_base group by procedure
union all
select 'type', coalesce(type, 'Non renseigné'), count(*),
    count(*) filter (where counted), sum(amount),
    count(*) filter (where counted and amount_estimated)
from procurement_base group by type;

create or replace table procurement_latest as
select c.* replace (b.notified_on::varchar as notified_on)
from contracts c
join procurement_base b using (uid)
order by b.notified_on desc, uid
limit 15;
