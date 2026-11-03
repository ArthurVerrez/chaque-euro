create or replace table procurement_bid_counts as
select r.uid,
    coalesce(case when count(distinct r.buyer_siren) = 1
        then min(case when i.public then r.buyer_siren end) end, '') as buyer,
    coalesce(case when count(distinct nullif(regexp_extract(r.cpv, '^([0-9]{2})', 1), '')) = 1
        then min(nullif(regexp_extract(r.cpv, '^([0-9]{2})', 1), '')) end, 'Non renseignée') as sector,
    case when min(r.offers) > 0 and min(r.offers) = max(r.offers) then min(r.offers) end as offers
from contract_rows r
left join identities i on i.siren = r.buyer_siren
where r.notified_on >= date '2024-01-01'
group by r.uid;

create or replace table procurement_competition as
select 'national' as dimension, '' as label, count(*) as total,
    count(offers) as known, count(*) filter (where offers = 1) as single_bid
from procurement_bid_counts
union all
select 'buyer', buyer, count(*), count(offers), count(*) filter (where offers = 1)
from procurement_bid_counts group by buyer
union all
select 'sector', sector, count(*), count(offers), count(*) filter (where offers = 1)
from procurement_bid_counts group by sector;
