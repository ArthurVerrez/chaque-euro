create or replace table commune_turnout as
with checked as (
    select *, voters between 0 and registered and abstentions >= 0
        and voters + abstentions = registered as valid
    from turnout_raw
)
select source_id, insee, department_code,
    case when valid then registered end as registered,
    case when valid then voters end as voters,
    case when valid then voters * 100.0 / nullif(registered, 0) end as turnout,
    (not valid)::integer as excluded_communes
from checked;

create or replace table department_turnout as
select source_id, department_code,
    sum(registered)::bigint as registered, sum(voters)::bigint as voters,
    sum(voters) * 100.0 / nullif(sum(registered), 0) as turnout,
    count(registered) as communes,
    sum(excluded_communes)::integer as excluded_communes
from commune_turnout group by all;
