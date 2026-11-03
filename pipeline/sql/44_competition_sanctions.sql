create or replace table competition_decisions as
select id_decision as id, Annee as year, max("Montant total") as amount,
    count(*) as company_rows
from sanction_input
where Annee >= 2009
group by id_decision, Annee;

create or replace table competition_companies as
select row_number() over (order by s.id_decision, s.Entreprise, s."Montant individuel") as id,
    s.id_decision as decision_id,
    case when i.public then i.siren end as siren,
    coalesce(i.label, 'Société ou organisme non rapproché') as name,
    s."Montant individuel" as amount
from sanction_input s
left join sanction_matches m on m.name_key = procurement_name(s.Entreprise)
left join identities i on i.siren = m.siren
where s.Annee >= 2009;
