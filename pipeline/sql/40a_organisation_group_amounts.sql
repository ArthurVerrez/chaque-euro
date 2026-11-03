create or replace table org_group_amounts as
select
    m.group_siren,
    m.siren,
    'titulaire' as measure,
    h.year,
    sum(h.share) as amount,
    count(*) as count,
    count(*) filter (where not h.counted) as unpriced,
    count(*) filter (where h.counted and h.amount_estimated) as estimated
from org_group_members m
join holder_shares h on h.holder_siren = m.siren and h.holder_public
group by all
union all
select
    m.group_siren,
    m.siren,
    'acheteur',
    b.year,
    sum(b.amount),
    count(*),
    count(*) filter (where not b.counted),
    count(*) filter (where b.counted and b.amount_estimated)
from org_group_members m
join buyer_contracts b on b.buyer_siren = m.siren
group by all
union all
select m.group_siren, m.siren, 'versement', g.year, sum(g.amount), count(*), 0, 0
from org_group_members m
join grants g on g.siren = m.siren
group by all;
