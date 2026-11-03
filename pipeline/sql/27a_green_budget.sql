create or replace table green_budget as
select 2026 as year, cotation_globale as rating,
    sum(nullif(plf_2026_cp_ou_prevision_2026_si_depense_fiscale, '')::double) as amount
from green_raw where type_depense='Crédits budgétaires'
group by cotation_globale;
