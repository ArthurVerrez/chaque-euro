create or replace table commune_turnout as
with checked as (
    select coalesce(m.insee, t.insee) as insee, t.* exclude (insee),
        voters between 0 and registered and abstentions >= 0
            and voters + abstentions = registered as valid
    from turnout_raw t
    left join commune_code_map m on m.old_insee = t.insee
)
select source_id, insee, any_value(department_code) as department_code,
    case when bool_and(valid) then sum(registered)::bigint end as registered,
    case when bool_and(valid) then sum(voters)::bigint end as voters,
    case when bool_and(valid) then sum(voters) * 100.0 / nullif(sum(registered), 0) end as turnout,
    count(*) filter (where not valid)::integer as excluded_communes
from checked
group by source_id, insee;

create or replace table department_turnout as
select source_id, department_code,
    sum(registered)::bigint as registered, sum(voters)::bigint as voters,
    sum(voters) * 100.0 / nullif(sum(registered), 0) as turnout,
    count(registered) as communes,
    sum(excluded_communes)::integer as excluded_communes
from commune_turnout group by all;
