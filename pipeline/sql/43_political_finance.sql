create or replace macro party_money(value) as
    coalesce(cast(nullif(nullif(trim(value), ''), '-') as decimal(20, 2)), 0);

create or replace table party_raw as
select * from party_raw_2021 where Exercice = '2021' union all
select * from party_raw_2022 where Exercice = '2022' union all
select * from party_raw_2023 where Exercice = '2023' union all
select * from party_raw_2024 where Exercice = '2024';

create or replace table party_component_totals as
select code, year, sum(party_money(replace(component, ',', '.'))) as amount
from (
    select *, 2021 as year from party_components_2021 union all
    select *, 2022 as year from party_components_2022 union all
    select *, 2023 as year from party_components_2023 union all
    select *, 2024 as year from party_components_2024
) group by all;

create or replace table party_accounts as
with amounts as (
    select Code_CNCCFP as code, trim(Nom_du_parti) as name, Exercice::integer as year,
        party_money(replace(Cotisations_des_adherents, ',', '.')) as members,
        party_money(replace(Cotisations_des_elus, ',', '.')) as elected,
        party_money(replace(Dons_de_personne_physique, ',', '.')) as donations,
        party_money(replace(Aide_publique_1ere_fraction, ',', '.')) as public_first,
        party_money(replace(Aide_publique_2nde_fraction, ',', '.')) as public_second,
        party_money(replace(Autres_aides_publiques, ',', '.')) as public_other,
        party_money(replace("Total_des_produits_I_+_III_+_V", ',', '.')) as resources
    from party_raw where Unite_monetaire = 'EUR'
)
select a.*, public_first + public_second + public_other as public_aid,
    resources - members - elected - donations - public_aid as other_resources,
    c.amount - resources as component_difference,
    abs(component_difference) <= 1 as reconciled,
    resources > 0 and public_aid > resources * 0.5 and reconciled as majority_public
from amounts a join party_component_totals c using (code, year);

create or replace table party_aid_losses as
select code, trim(name) as name, 2024 as exercise, decision, reason,
    strptime(aid_loss_until, '%d/%m/%Y')::date::varchar as until_date
from party_status_raw
where nullif(trim(aid_loss_until), '') is not null;

create or replace table party_accounts as
select * replace (
    members::double as members, elected::double as elected, donations::double as donations,
    public_first::double as public_first, public_second::double as public_second,
    public_other::double as public_other, resources::double as resources,
    public_aid::double as public_aid, other_resources::double as other_resources,
    component_difference::double as component_difference
) from party_accounts;
