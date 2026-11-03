create or replace table procurement_recent_uids as
select uid from contract_rows
group by uid
order by min(notified_on) desc, uid
limit 15;
