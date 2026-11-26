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
        regexp_replace(upper(titulaire_id), '[^0-9A-Z]', '', 'g') as holder_key,
        case
            when regexp_full_match(holder_key, '[0-9]{14}') then left(holder_key, 9)
            when regexp_full_match(holder_key, '[0-9]{9}') then holder_key
            when regexp_full_match(holder_key, 'FR[0-9]{11}')
                and holder_key[3:4]::integer = (12 + 3 * (right(holder_key, 9)::bigint % 97)) % 97
                then right(holder_key, 9)
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
select * exclude (holder_key)
from raw
qualify row_number() over (
    partition by uid, coalesce(holder_siren, holder_id)
    order by modification_id desc, published_on desc nulls last, source_url,
        declared_amount desc nulls last, amount desc nulls last, amount_flag,
        subject, cpv, buyer_siren, holder_id, offers desc nulls last,
        procedure, nature, holder_activity
) = 1;

create or replace temp macro contract_keys() as table
select uid, min(buyer_siren) as buyer_siren, min(record_id) as record_id,
    regexp_replace(lower(min(record_id)), '[^a-z0-9]', '', 'g') as record_key,
    min(notified_on) as notified_on, max(modification_id) as modification_id,
    max(published_on) as published_on, min(declared_amount) as declared_amount,
    min(regexp_replace(lower(subject), '\W', '', 'g')) as subject_key,
    coalesce(list_sort(list(coalesce(holder_siren, holder_id))
        filter (where coalesce(holder_siren, holder_id) is not null)), []) as holders,
    count(coalesce(holder_siren, holder_id)) = count(*) as complete,
    min(source_dataset) as source_dataset,
    bool_or(source_dataset like 'pes_marche%' or source_dataset = 'decp_colmo') as pes
from contract_rows
group by uid;

create or replace temp table contract_chains as
select uid,
    row_number() over (
        chain order by source_dataset = 'pes_marche_2024' desc, modification_id desc,
            published_on desc nulls last, record_id desc
    ) as position,
    arg_min(notified_on, coalesce(published_on, date '9999-12-31')) over chain
        as first_notified_on
from contract_keys()
where buyer_siren is not null and complete
    and (source_dataset = 'pes_marche_2024' or regexp_full_match(record_id, '.{4,}[0-9]{2}'))
window chain as (
    partition by buyer_siren, subject_key, if(pes, null, holders), case
        when source_dataset = 'pes_marche_2024' then record_id
        else left(record_id, length(record_id) - 2)
    end
)
qualify len(list_reduce(list(holders) over chain, (a, b) -> list_intersect(a, b))) > 0 and (
    max(modification_id) over chain > 0
        and (bool_or(pes) over chain or bool_or(right(record_id, 2) = '00') over chain)
    or bool_and(pes) over chain
        and min(declared_amount) over chain = max(declared_amount) over chain
);

delete from contract_rows where uid in (select uid from contract_chains where position > 1);

update contract_rows set notified_on = c.first_notified_on
from contract_chains c
where c.uid = contract_rows.uid and c.position = 1;

drop table contract_chains;

delete from contract_rows where uid in (
    with copies as (
        select *, row_number() over (
            partition by buyer_siren, notified_on, declared_amount, holders, source_dataset
            order by uid
        ) as copy
        from contract_keys()
        where buyer_siren is not null and complete and declared_amount > 0
    )
    select uid from copies
    qualify row_number() over (
        partition by buyer_siren, notified_on, declared_amount, holders, copy
        order by published_on desc nulls last, uid
    ) > 1
);

delete from contract_rows where uid in (
    select b.uid
    from contract_keys() a
    join contract_keys() b using (buyer_siren, subject_key, declared_amount)
    where abs(a.notified_on - b.notified_on) <= 92
        and length(least(a.record_key, b.record_key)) >= 4
        and (contains(a.record_key, b.record_key) or contains(b.record_key, a.record_key))
        and (len(b.holders) = 0 or len(list_intersect(a.holders, b.holders)) > 0)
        and (len(a.holders), a.modification_id, coalesce(a.published_on, date '0001-01-01'), a.uid)
            > (len(b.holders), b.modification_id, coalesce(b.published_on, date '0001-01-01'), b.uid)
);

create or replace temp table shared_contracts as
with keys as (
    select *, notified_on - lag(notified_on) over (
        partition by buyer_siren, subject_key, declared_amount order by notified_on, uid
    ) > 31 as starts_period
    from contract_keys()
    where buyer_siren is not null and declared_amount > 0 and subject_key <> ''
), periods as (
    select *, count(*) filter (where starts_period) over (
        partition by buyer_siren, subject_key, declared_amount order by notified_on, uid
    ) as period
    from keys
)
select uid, min(uid) over shared as shared_uid, min(notified_on) over shared as shared_notified_on
from periods
window shared as (partition by buyer_siren, subject_key, declared_amount, period)
qualify len(list_distinct(flatten(list(holders) over shared))) > 1;

update contract_rows set uid = s.shared_uid, notified_on = s.shared_notified_on
from shared_contracts s
where s.uid = contract_rows.uid;

drop table shared_contracts;

delete from contract_rows where rowid in (
    select rowid from contract_rows
    qualify row_number() over (
        partition by uid, coalesce(holder_siren, holder_id)
        order by modification_id desc, published_on desc nulls last, record_id
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
    coalesce(details.amount_flag, case
        when details.amount >= 999999999
            or details.amount >= 9999999 and regexp_full_match(details.amount::varchar, '9+(\.0+)?')
            then 'hors_norme'
    end) as amount_flag,
    coalesce(amount_flag is null and details.amount > 0, false) as counted
from retained;
