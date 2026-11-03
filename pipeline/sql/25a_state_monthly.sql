create or replace table monthly_values as
select
    "Niveau hiérarchique"::integer as level,
    "Catégorie" as category, "Sous-catégorie" as subcategory,
    trim("Ligne d'information") as label,
    split_part(period, '/', 3)::integer as year,
    split_part(period, '/', 2)::integer as month,
    replace(value, ',', '.')::double as amount
from (unpivot monthly_raw on columns(* exclude (
    "Niveau hiérarchique", "Niveau hiérarchique de la ligne", "Catégorie",
    "Sous-catégorie", "Ligne d'information")) into name period value value)
where value <> '';

create or replace table monthly_totals as
select year, month,
    max(amount) filter (where label='Total dépenses nettes du budget général') as spending,
    sum(amount) filter (where category='Dépenses' and subcategory='Budget général' and level=2) as spending_parts,
    max(amount) filter (where label='Total recettes nettes du budget général') as revenue,
    sum(amount) filter (where category='Recettes' and subcategory='Budget général' and level=2) as revenue_parts
from monthly_values group by year, month;

create or replace table state_monthly as
select year, month,
    max(amount) filter (where label='Total dépenses nettes du budget général') as spending,
    max(amount) filter (where label='Total recettes nettes du budget général') as revenue,
    max(amount) filter (where label='Solde budgétaire') as balance,
    max(amount) filter (where label='Total prélèvements sur recettes') as transfers,
    max(amount) filter (where label='Fonds de concours et attribution de produits') as funds,
    max(amount) filter (where label='Solde des comptes spéciaux') as special,
    max(amount) filter (where label='Solde des Budgets annexes') as annex
from monthly_values group by year, month;
