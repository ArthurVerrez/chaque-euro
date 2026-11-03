create or replace table campaign_accounts as select * from campaign_accounts_raw;
create or replace table campaign_account_lines as select * from campaign_lines_raw;
create or replace table campaign_decisions as select * from municipal_raw;

create or replace table transparency_alerts as
select election_id || ':' || candidate_id as id, election_id,candidate_id,candidate_name,territory_code,
    case decision_code when 'R' then 'rejected-account' when 'AD' then 'not-filed'
        when 'HD' then 'late-filed' end as rule,
    decision_label as official_status,published_on as observed_on,source_id
from campaign_accounts where decision_code in ('R','AD','HD');
