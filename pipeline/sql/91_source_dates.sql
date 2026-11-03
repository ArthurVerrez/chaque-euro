create or replace table coverage_dates as
select 'decp' as source_id, max(notified_on)::date as data_date from contract_rows
union all select 'ofgl-communes', make_date(max(year),12,31) from ofgl_rows
union all select 'jaune-associations', make_date(max(year),12,31) from grant_rows
union all select 'insee-apu', make_date(max(year),12,31) from public_finances
union all select 'insee-apu-comptes', make_date(max(year),12,31) from public_accounts
union all select 'insee-apu-fonctions', make_date(max(year),12,31) from public_functions
union all select 'state-monthly', last_day(make_date(year,month,1)) from state_monthly
    qualify row_number() over (order by year desc,month desc)=1
union all select 'state-titles', make_date(max(year),12,31) from state_titles
union all select 'state-ministries', make_date(max(year),12,31) from state_ministries
union all select 'state-assets', make_date(max(year),12,31) from state_assets
union all select 'insee-levies', make_date(max(year),12,31) from compulsory_levies
union all select 'eurostat-finances', last_day(make_date(left(max(period),4)::integer,
    right(max(period),1)::integer * 3,1)) from quarterly_debt
union all select 'drees-protection', make_date(max(year),12,31) from social_benefits
union all select 'green-budget', make_date(max(year),12,31) from green_budget;

insert into coverage_dates
select 'ccss-octobre-2026', make_date(max(year),12,31) from social_branches
    where source_id='ccss-octobre-2026' and stage='Résultat'
union all select 'drees-sante-financeurs', make_date(max(year),12,31) from health_payers
union all select 'drees-retraites', make_date(max(year),12,31) from pension_indicators
union all select 'cnaf-depenses', make_date(max(year),12,31) from family_benefits
union all select 'unedic-finances', make_date(max(year),12,31) from unemployment_accounts;

insert into coverage_dates
select source_id,max(voted_on)::date from public_ballots group by source_id
union all select 'hatvp-interests', max(published_on)::date from interest_declarations
union all select 'cada', max(session_on)::date from cada_opinions
union all select 'rne', max(data_date)::date from rne_statistics
union all select source_id,max(published_on)::date from campaign_accounts group by source_id;
