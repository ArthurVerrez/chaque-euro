create or replace table procurement_notices as
select b.id, left(b.subject, 300) as subject, b.published_on::varchar as published_on,
    strftime(b.deadline at time zone 'UTC', '%Y-%m-%dT%H:%M:%SZ') as deadline, b.procedure,
    case when i.public then b.buyer_id end as buyer_siren,
    coalesce(i.label, 'Acheteur non identifié') as buyer_name, b.estimated_range
from boamp_input b
left join identities i on i.siren = b.buyer_id
where b.deadline > getvariable('procurement_as_of')::timestamptz
qualify row_number() over (partition by b.id order by b.published_on desc) = 1;

create or replace table procurement_projects as
select p.code::varchar as id, left(p.libelle, 300) as subject,
    p.date_previsionnelle_de_publication::varchar as expected_on,
    p.categorie_d_achat as category, p.type_de_procedure as procedure,
    p.montant_estime_du_marche as estimated_range,
    case when i.public then i.siren end as buyer_siren,
    coalesce(i.label, 'Acheteur non identifié') as buyer_name
from approch_input p
left join identities i on i.siren = p.siren_de_l_entite_acheteuse::varchar
where p.statut = 'Ouvert'
    and p.date_previsionnelle_de_publication >= getvariable('procurement_as_of');
