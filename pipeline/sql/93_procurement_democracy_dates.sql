insert into coverage_dates
select 'boamp', max(published_on)::date from procurement_notices
union all select 'approch', getvariable('procurement_as_of')::date
union all select 'hatvp-agora', getvariable('lobbying_as_of')::date
union all select 'hatvp-defaults', getvariable('lobbying_as_of')::date
union all select 'eu-transparency', getvariable('eu_exported')::date
union all select 'cnccfp-parties', make_date(max(year), 12, 31) from party_accounts;
