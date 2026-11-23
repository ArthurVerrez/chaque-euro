create or replace table marseille_repayments as
select exer::integer as year,
    max(montant) filter (where agregat = 'Remboursements d''emprunts hors GAD') as repayments,
    max(montant) filter (where agregat = 'Dépenses totales') as total_including_principal
from read_json(getvariable('marseille_repayments_path'))
group by year;
