create or replace table nantes_consolidation as
select exer::integer as year, i.item, ptot::integer as population,
    montant_gfp as metro, montant_communes as municipalities, montant_flux as transfers,
    montant as spending, euros_par_habitant as per_capita
from read_json(getvariable('nantes_consolidation_path')) n
join finance_items i on i.aggregate = n.agregat;
