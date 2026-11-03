create or replace table holder_shares as
select
    r.uid,
    r.buyer_siren,
    r.holder_siren,
    holder_label(r.holder_siren, i.label) as holder_label,
    coalesce(i.public, false) as holder_public,
    r.notified_on,
    year(r.notified_on) as year,
    a.counted,
    a.amount_estimated,
    case when a.counted then a.amount / a.holders end as share
from contract_rows r
join contract_amounts a using (uid)
left join identities i on i.siren = r.holder_siren;

create or replace table buyer_contracts as
select
    uid,
    any_value(buyer_siren) as buyer_siren,
    any_value(notified_on) as notified_on,
    any_value(year) as year,
    any_value(counted) as counted,
    any_value(amount_estimated) as amount_estimated,
    sum(share) as amount
from holder_shares
where buyer_siren is not null
group by uid;

create or replace table org_years as
select holder_siren as siren, 'titulaire' as role, year, coalesce(sum(share), 0) as amount, count(*) as count
from holder_shares
where holder_public
group by all
union all
select b.buyer_siren, 'acheteur', b.year, coalesce(sum(b.amount), 0), count(*)
from buyer_contracts b
join identities i on i.siren = b.buyer_siren and i.public
group by all;

create or replace table org_counterparts as
with pairs as (
    select
        holder_siren as siren,
        'titulaire' as role,
        case when i.public then h.buyer_siren end as counterpart_siren,
        coalesce(i.label, 'Acheteur non identifié') as counterpart_name,
        coalesce(sum(share), 0) as amount,
        count(*) as count
    from holder_shares h
    left join identities i on i.siren = h.buyer_siren
    where holder_public
    group by all
    union all
    select
        buyer_siren,
        'acheteur',
        case when holder_public then holder_siren end,
        holder_label,
        coalesce(sum(share), 0),
        count(*)
    from holder_shares
    where buyer_siren in (select siren from identities where public)
    group by all
)
select *, row_number() over (partition by siren, role order by amount desc, count desc) as rank
from pairs
qualify rank <= 8;

create or replace table org_contract_uids as
with candidates as (
    select holder_siren as siren, 'titulaire' as role, uid, counted, share as amount, notified_on
    from holder_shares
    where holder_public
    union all
    select b.buyer_siren, 'acheteur', b.uid, b.counted, b.amount, b.notified_on
    from buyer_contracts b
    join identities i on i.siren = b.buyer_siren and i.public
)
select siren, role, uid
from candidates
qualify row_number() over (partition by siren, role order by counted desc, amount desc nulls last) <= 8
    or row_number() over (partition by siren, role order by notified_on desc) <= 3;

create or replace table source_files as
select row_number() over (order by source_url) as id, source_url as url
from (select distinct source_url from contract_rows where uid in (select uid from org_contract_uids union select uid from procurement_recent_uids))
where source_url is not null;

create or replace table contracts as
with holders as (
    select
        uid,
        count(*) as holders,
        list(holder_label order by holder_public desc, holder_label) as labels
    from holder_shares
    where uid in (select uid from org_contract_uids union select uid from procurement_recent_uids)
    group by uid
)
select
    row_number() over (order by r.uid) as id,
    r.uid,
    any_value(case when i.public then r.buyer_siren end) as buyer_siren,
    left(any_value(r.subject), 160) as subject,
    any_value(a.amount) as amount,
    any_value(a.amount_flag) as amount_flag,
    any_value(a.declared_amount) as declared_amount,
    any_value(a.amount_estimated) as amount_estimated,
    any_value(a.counted) as amount_counted,
    any_value(h.holders) as holders,
    case
        when any_value(h.holders) <= 2 then array_to_string(any_value(h.labels), ', ')
        else array_to_string(any_value(h.labels)[1:2], ', ')
            || ' et ' || (any_value(h.holders) - 2) || ' autres'
    end as holders_label,
    any_value(r.notified_on)::varchar as notified_on,
    any_value(f.id) as source_file_id
from contract_rows r
join holders h using (uid)
join contract_amounts a using (uid)
left join identities i on i.siren = r.buyer_siren
left join source_files f on f.url = r.source_url
group by r.uid;

create or replace table org_contracts as
select o.siren, o.role, c.id as contract_id
from org_contract_uids o
join contracts c using (uid);

create or replace table grants as
select
    row_number() over (order by g.siren, g.amount desc) as id,
    g.siren,
    g.year,
    g.programme_code,
    b.programme as programme_label,
    g.amount,
    g.purpose
from grant_rows g
join identities i on i.siren = g.siren and i.public
left join (select distinct programme_code, programme from plrg_programmes) b using (programme_code);

create or replace table orgs as
with totals as (
    select
        siren,
        sum(amount) filter (where role = 'titulaire') as won_amount,
        sum(count) filter (where role = 'titulaire') as won_count,
        sum(amount) filter (where role = 'acheteur') as awarded_amount,
        sum(count) filter (where role = 'acheteur') as awarded_count
    from org_years
    group by siren
),
amount_quality as (
    select holder_siren as siren, 'titulaire' as role, count(*) filter (where not counted) as n,
        count(*) filter (where counted and amount_estimated) as estimated
    from holder_shares
    where holder_public
    group by all
    union all
    select buyer_siren, 'acheteur', count(*) filter (where not counted),
        count(*) filter (where counted and amount_estimated)
    from buyer_contracts
    group by all
),
grant_totals as (
    select siren, sum(amount) as grants_amount, count(*) as grants_count
    from grants
    group by siren
),
activities as (
    select holder_siren as siren, mode(holder_activity) as activity
    from contract_rows
    where holder_activity is not null
    group by holder_siren
)
select
    i.siren,
    i.label as name,
    org_kind(i.legal_category) as kind,
    i.legal_category,
    a.activity,
    i.active,
    coalesce(t.won_amount, 0) as won_amount,
    coalesce(t.won_count, 0) as won_count,
    coalesce(uw.n, 0) as won_unpriced,
    coalesce(uw.estimated, 0) as won_estimated,
    coalesce(t.awarded_amount, 0) as awarded_amount,
    coalesce(t.awarded_count, 0) as awarded_count,
    coalesce(ua.n, 0) as awarded_unpriced,
    coalesce(ua.estimated, 0) as awarded_estimated,
    coalesce(g.grants_amount, 0) as grants_amount,
    coalesce(g.grants_count, 0) as grants_count
from identities i
left join totals t using (siren)
left join grant_totals g using (siren)
left join activities a using (siren)
left join amount_quality uw on uw.siren = i.siren and uw.role = 'titulaire'
left join amount_quality ua on ua.siren = i.siren and ua.role = 'acheteur'
where i.public and (t.siren is not null or g.siren is not null
    or i.siren in (select buyer_id from boamp_input)
    or i.siren in (select siren_de_l_entite_acheteuse::varchar from approch_input)
    or i.siren in (select siren from sanction_matches));
