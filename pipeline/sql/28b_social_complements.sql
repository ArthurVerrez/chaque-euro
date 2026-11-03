create or replace table health_payers as
select annee::integer as year, financeur as code, financeur_lib as label,
    montant::double as amount
from health_raw where poste='d00000' and financeur in ('f000','f110','f120','f210','f220','f300');

create or replace table pension_indicators as
select "Année"::integer as year, "Sexe" as sex,
    effectifs::integer as recipients, m1::double as monthly_pension
from pensions_raw where "CC"='0000' and "Resid"='Ensemble' and "Champ"='ddir'
    and "Liq"='Ensemble' and "StatutSNCF"='Ensemble' and "PlusRécent"='1';

create or replace table family_benefits as
select annee::integer as year, prestations as label, dep_ts_regimes::double * 1e6 as amount
from family_raw where prestations in (
    'Total prestations légales enfance et jeunesse (AF, CF, ARS, ASF, AEH, AJPP)',
    'Total prestations légales jeune enfant', 'Total prestation logement',
    'Total Prestations légales directes', 'Revenu solidarité active (RSA versé yc prime, créances, indus)',
    'Prime d''activité', 'Allocation adultes handicapés (AAH + MVA + GRPH)'
);

create or replace table unemployment_accounts as
select annee::integer as year, recettes_total::double * 1e6 as revenue,
    depenses_total::double * 1e6 as spending, solde_technique::double * 1e6 as balance,
    elements_exceptionnels::double * 1e6 as exceptional,
    solde_financier::double * 1e6 as financial_balance,
    depenses_allocations_brutes_et_aides::double * 1e6 as benefits,
    depenses_financement_pole_emploi_france_travail_et_frais_de_recouvrement::double * 1e6 as employment_services,
    dette::double * 1e6 as debt
from unemployment_raw;
