insert into coverage_dates
select 'ofgl-' || case level when 'departement' then 'departements'
    when 'region' then 'regions' else 'epci' end,
    make_date(max(year), 12, 31)
from local_account_rows group by level
union all select 'rei-2025', make_date(max(year), 12, 31) from commune_taxes
union all select 'rei-' || year, make_date(year, 12, 31) from commune_tax_rates where year between 2021 and 2024 group by year
union all select 'insee-ipch', last_day(strptime(max(period), '%Y-%m')) from ipch_raw
union all select 'ircom-2025', make_date(max(revenue_year), 12, 31) from commune_income;
