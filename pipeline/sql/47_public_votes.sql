create or replace table public_ballots as
select * from ballots_raw union all select * from senate_ballots;

create or replace table public_votes as
select distinct * from votes_raw
union all
select distinct v.ballot_id, v.person_id, v.position, g.organ_id, v.delegated, v.source_status, v.source_id
from senate_votes v
join public_ballots b on b.id=v.ballot_id
left join lateral (
    select m.organ_id from public_mandates m
    where m.person_id=v.person_id and m.kind='GP'
      and m.starts_on<=b.voted_on and (m.ends_on is null or m.ends_on>=b.voted_on)
    order by m.starts_on desc limit 1
) g on true;

create or replace table public_vote_corrections as
select * from corrections_raw union all select * from senate_corrections;

create or replace table public_person_metrics as
with windows as (
    select 'legislature' as window_kind, date '2024-07-08' as start_on,
        getvariable('democracy_as_of')::date as end_on
    union all select '12-months', (getvariable('democracy_as_of')::date - interval '1 year')::date,
        getvariable('democracy_as_of')::date
), eligible as (
    select distinct m.person_id,b.id,w.window_kind,w.start_on,w.end_on,b.source_id
    from public_mandates m
    join public_ballots b on b.chamber=m.chamber
        and b.voted_on::date >= try_cast(m.starts_on as date)
        and (m.ends_on is null or b.voted_on::date <= try_cast(m.ends_on as date))
    cross join windows w
    where m.kind='ASSEMBLEE' and m.date_precision='day'
        and b.voted_on::date between w.start_on and w.end_on
    union
    select v.person_id,b.id,w.window_kind,w.start_on,w.end_on,b.source_id
    from senate_votes v
    join public_ballots b on b.id=v.ballot_id
    cross join windows w
    where b.voted_on::date between w.start_on and w.end_on
)
select e.person_id,e.window_kind,e.start_on::varchar as window_start,e.end_on::varchar as window_end,
    count(*) filter (where v.position in ('pour','contre','abstention'))::integer as numerator,
    count(*)::integer as denominator,
    numerator::double / denominator as value, e.source_id
from eligible e left join public_votes v on v.ballot_id=e.id and v.person_id=e.person_id
group by all;
