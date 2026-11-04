insert into coverage_dates
select 'ofgl-' || case level when 'departement' then 'departements'
    when 'region' then 'regions' else 'epci' end,
    make_date(max(year), 12, 31)
from local_account_rows group by level
union all select 'rei-2025', make_date(max(year), 12, 31) from commune_taxes
union all select 'ircom-2025', make_date(max(revenue_year), 12, 31) from commune_income;
