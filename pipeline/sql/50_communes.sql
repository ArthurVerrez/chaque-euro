create or replace table finance_items as
select * from (values
    ('depenses', 'Dépenses totales hors remb', 'Dépenses totales (hors remboursement de la dette)', 'total', 1),
    ('fonctionnement', 'Dépenses de fonctionnement', 'Dépenses de fonctionnement', 'total', 2),
    ('investissement', 'Dépenses d''investissement hors remb', 'Dépenses d''investissement', 'total', 3),
    ('personnel', 'Frais de personnel', 'Salaires et charges du personnel', 'depense', 10),
    ('achats', 'Achats et charges externes', 'Achats et services extérieurs', 'depense', 11),
    ('intervention', 'Dépenses d''intervention', 'Aides, subventions et participations versées', 'depense', 12),
    ('subventions_privees', 'Subventions aux personnes de droit privé', 'dont subventions aux associations et organismes privés', 'depense', 13),
    ('interets', 'Charges financières', 'Intérêts de la dette', 'depense', 14),
    ('equipement', 'Dépenses d''équipement', 'Travaux et équipements', 'depense', 15),
    ('subventions_equipement', 'Subventions d''équipement versées', 'Subventions d''équipement versées', 'depense', 16),
    ('recettes', 'Recettes totales hors emprunts', 'Recettes totales (hors emprunts)', 'recette', 20),
    ('impots_locaux', 'Impôts locaux', 'Impôts locaux', 'recette', 21),
    ('dgf', 'Dotation globale de fonctionnement', 'Dotation globale de fonctionnement versée par l''État', 'recette', 22),
    ('epargne_brute', 'Epargne brute', 'Épargne brute (recettes moins dépenses de fonctionnement)', 'dette', 30),
    ('dette', 'Encours de dette', 'Dette au 31 décembre', 'dette', 31)
) as t(item, aggregate, label, section, sort);

create or replace table strata_labels as
select * from (values
    ('0', 'moins de 100 habitants'),
    ('1', '100 à 199 habitants'),
    ('2', '200 à 499 habitants'),
    ('3', '500 à 1 999 habitants'),
    ('4', '2 000 à 3 499 habitants'),
    ('5', '3 500 à 4 999 habitants'),
    ('6', '5 000 à 9 999 habitants'),
    ('7', '10 000 à 19 999 habitants'),
    ('8', '20 000 à 49 999 habitants'),
    ('9', '50 000 à 99 999 habitants'),
    ('10', '100 000 habitants ou plus')
) as t(stratum, label);

create or replace table ofgl_rows as
select
    o.year::integer as year,
    o.com_code as insee,
    o.com_name as name,
    o.dep_code as department_code,
    o.dep_name as department_name,
    o.reg_name as region_name,
    o.siren,
    o.tranche_population as stratum,
    o.ptot::bigint as population,
    f.item,
    o.montant as amount
from read_json(getvariable('ofgl_path'), format = 'newline_delimited') o
join finance_items f on f.aggregate = o.agregat;

create or replace table commune_years as
select insee, year, sum(population)::bigint as population, arg_max(stratum, population) as stratum
from (select distinct insee, year, siren, population, stratum from ofgl_rows)
group by all;

create or replace table communes as
select r.insee, r.name, r.department_code, r.department_name, r.region_name, r.siren, y.population, y.stratum, r.year
from ofgl_rows r
join commune_years y using (insee, year)
qualify row_number() over (partition by r.insee order by r.year desc, r.population desc) = 1;

create or replace table commune_finances as
select f.insee, f.year, f.item, f.amount, case when y.population > 0 then f.amount / y.population end as per_capita
from (select insee, year, item, sum(amount) as amount from ofgl_rows group by all) f
join commune_years y using (insee, year);

create or replace table strata as
select
    y.stratum,
    l.label,
    f.year,
    f.item,
    median(f.per_capita) as median_per_capita,
    count(*) as communes
from commune_finances f
join commune_years y using (insee, year)
join strata_labels l using (stratum)
where f.per_capita is not null
group by all;
