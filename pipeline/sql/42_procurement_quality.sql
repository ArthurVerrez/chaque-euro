create or replace table procurement_quality as
with originals as (
    select uid, min(dateNotification) as notified_on,
        min(datePublicationDonnees) as published_on,
        any_value(montant) as amount,
        bool_and(montant_anomalie is null) as unflagged
    from read_parquet(getvariable('decp_path'))
    where modification_id = 0
    group by uid
), buyers as (
    select uid, any_value(buyer_siren) as siren from contract_rows group by uid
), assessed as (
    select year(o.notified_on) as year,
        case when i.legal_category is null then 'Catégorie inconnue'
            else org_kind(i.legal_category) end as category,
        o.amount >= 40000 and o.amount < 999999999 and o.unflagged
            and o.notified_on + interval '2 months' <= getvariable('decp_retrieved_on') as eligible,
        o.published_on between o.notified_on and getvariable('decp_retrieved_on') as valid,
        o.published_on <= o.notified_on + interval '2 months' as on_time
    from originals o
    join buyers b using (uid)
    left join identities i on i.siren = b.siren
    where o.notified_on between date '2019-01-01' and getvariable('decp_retrieved_on')
)
select year, category, count(*) as total,
    count(*) filter (where eligible) as eligible,
    count(*) filter (where eligible and valid) as valid,
    count(*) filter (where eligible and valid and on_time) as on_time
from assessed group by year, category;
