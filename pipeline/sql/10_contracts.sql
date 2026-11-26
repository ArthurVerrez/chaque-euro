create or replace table contract_rows as
with dates as (
    select uid, coalesce(min(dateNotification) filter (where modification_id = 0),
        min(dateNotification)) as first_notified_on
    from read_parquet(getvariable('decp_path'))
    group by uid
), raw as (
    select
        uid,
        id as record_id,
        nullif(trim(regexp_replace(objet, '\s+', ' ', 'g')), '') as subject,
        nature,
        procedure,
        codeCPV as cpv,
        d.first_notified_on as notified_on,
        montant as declared_amount,
        case when montant_anomalie is not null then montant_rationalise else montant end as amount,
        montant_anomalie is not null and montant_rationalise is not null
            and (montant_anomalie = 'aberrant' or montant_rationalise <> montant) as amount_estimated,
        offresRecues as offers,
        montant_anomalie as amount_flag,
        case when regexp_full_match(acheteur_id, '[0-9]{14}') then left(acheteur_id, 9) end
            as buyer_siren,
        case
            when regexp_full_match(titulaire_id, '[0-9]{14}') then left(titulaire_id, 9)
            when regexp_full_match(titulaire_id, '[0-9]{9}') then titulaire_id
        end as holder_siren,
        titulaire_id as holder_id,
        titulaire_activite_libelle as holder_activity,
        sourceFile as source_url,
        sourceDataset as source_dataset,
        modification_id,
        datePublicationDonnees as published_on
    from read_parquet(getvariable('decp_path')) r
    join dates d using (uid)
    where donneesActuelles
        and d.first_notified_on between date '2019-01-01' and getvariable('decp_retrieved_on')
)
select *
from raw
qualify row_number() over (
    partition by uid, coalesce(holder_siren, holder_id)
    order by modification_id desc, published_on desc nulls last, source_url,
        declared_amount desc nulls last, amount desc nulls last, amount_flag,
        subject, cpv, buyer_siren, holder_id, offers desc nulls last,
        procedure, nature, holder_activity
) = 1;

delete from contract_rows where uid in (
    with contracts as (
        select uid, min(buyer_siren) as buyer_siren, min(notified_on) as notified_on,
            min(declared_amount) as declared_amount, min(source_dataset) as source_dataset,
            max(published_on) as published_on,
            list_sort(list(coalesce(holder_siren, holder_id))) as holders
        from contract_rows
        group by uid
        having count(coalesce(holder_siren, holder_id)) = count(*)
    ), copies as (
        select *, row_number() over (
            partition by buyer_siren, notified_on, declared_amount, holders, source_dataset
            order by uid
        ) as copy
        from contracts
        where buyer_siren is not null and declared_amount > 0
    )
    select uid from copies
    qualify row_number() over (
        partition by buyer_siren, notified_on, declared_amount, holders, copy
        order by published_on desc nulls last, uid
    ) > 1
);

delete from contract_rows where uid in (
    with contracts as (
        select uid, min(buyer_siren) as buyer_siren, min(record_id) as record_id,
            min(notified_on) as notified_on, max(modification_id) as modification_id,
            max(published_on) as published_on,
            min(regexp_replace(lower(subject), '\W', '', 'g')) as subject_key,
            list_sort(list(coalesce(holder_siren, holder_id))) as holders
        from contract_rows
        where source_dataset like 'pes_marche%' or source_dataset = 'decp_colmo'
        group by uid
        having count(coalesce(holder_siren, holder_id)) = count(*)
    )
    select uid from contracts
    where buyer_siren is not null and regexp_full_match(record_id, '[0-9]{7,}')
    window chain as (
        partition by buyer_siren, left(record_id, length(record_id) - 2), notified_on,
            subject_key, holders
    )
    qualify max(modification_id) over chain > 0 and row_number() over (
        chain order by modification_id desc, published_on desc nulls last, record_id desc
    ) > 1
);

create or replace table contract_amounts as
with retained as (
    select uid, count(*) as holders,
        first(struct_pack(amount, declared_amount, amount_flag, amount_estimated)
            order by modification_id desc, published_on desc nulls last, holder_id nulls last,
                source_url, declared_amount desc nulls last, amount desc nulls last) as details
    from contract_rows group by uid
)
select uid, holders, details.amount as amount, details.declared_amount as declared_amount,
    details.amount_estimated as amount_estimated,
    coalesce(details.amount_flag, case when details.amount >= 999999999 then 'hors_norme' end)
        as amount_flag,
    coalesce(details.amount_flag is null and details.amount > 0 and details.amount < 999999999, false)
        as counted
from retained;
