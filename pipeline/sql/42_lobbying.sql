create or replace macro organisation_name(value) as
    regexp_replace(lower(strip_accents(trim(value))), '[^a-z0-9]', '', 'g');

create or replace table lobbying_public_organisations as
with legal_units as (
    select siren, categorieJuridiqueUniteLegale::varchar as category,
        statutDiffusionUniteLegale as diffusion
    from read_parquet(getvariable('sirene_path'))
    where siren in (select identifiant_national from agora_organisations
                    where type_identifiant_national = 'SIREN')
)
select g.representants_id as id, g.identifiant_national as identifier,
    case when g.type_identifiant_national = 'SIREN' then g.identifiant_national end as siren,
    trim(g.denomination) as name, g.pays as country,
    g.label_categorie_organisation as category, g.dateCessation is null as active
from agora_organisations g
left join legal_units u on u.siren = g.identifiant_national
where (g.type_identifiant_national = 'SIREN' and u.category <> '1000' and u.diffusion = 'O')
   or (g.type_identifiant_national = 'RNA' and g.label_categorie_organisation = 'Association');

create or replace table lobbying_organisation_ids as
select id as source_id, first_value(id) over (
    partition by identifier order by active desc, id::integer desc
) as organisation_id
from lobbying_public_organisations;

create or replace table lobbying_organisations as
select * from lobbying_public_organisations
qualify row_number() over (partition by identifier order by active desc, id::integer desc) = 1;

create or replace table lobbying_exercises as
select e.exercices_id as id, m.organisation_id,
    e.date_debut::date::varchar as starts_on, e.date_fin::date::varchar as ends_on,
    e.date_publication::date::varchar as published_on,
    coalesce(a.activities, 0) as activities,
    e.nombre_activites::integer as declared_activities,
    coalesce(a.activities, 0) = e.nombre_activites::integer as activities_reconciled,
    e.montant_depense as budget_label,
    case when e.montant_depense is not null then e.montant_depense_inf::double end as budget_min,
    case when e.montant_depense is not null then nullif(e.montant_depense_sup::double, 'Infinity'::double) end as budget_max
from agora_exercises e
join lobbying_organisation_ids m on m.source_id = e.representants_id
left join (select exercices_id, count(*) as activities from agora_activities group by exercices_id) a
    on a.exercices_id = e.exercices_id
where e.date_publication is not null;

create or replace table lobbying_activities as
select a.activite_id as id, a.exercices_id as exercise_id,
    a.date_publication_activite::date::varchar as published_on
from agora_activities a
join lobbying_exercises e on e.id = a.exercices_id;

create or replace table lobbying_targets as
select distinct a.id as activity_id, 'institution' as kind,
    case
        when t.responsable_public like 'Député, sénateur,%' then 'Parlement'
        when t.responsable_public = 'Membre du Gouvernement ou membre de cabinet ministériel'
            then 'Gouvernement et cabinets ministériels'
        when t.responsable_public = 'Collaborateur du Président de la République'
            then 'Présidence de la République'
        when t.responsable_public like 'Directeur ou secrétaire général,%'
            then 'Autorités administratives et publiques indépendantes'
        else t.responsable_public
    end as label
from agora_targets t
join lobbying_activities a on a.id = t.action_representation_interet_id
where t.responsable_public is not null
union
select distinct a.id, 'ministry', trim(t.departement_ministeriel)
from agora_targets t
join lobbying_activities a on a.id = t.action_representation_interet_id
where t.departement_ministeriel is not null
    and t.responsable_public = 'Membre du Gouvernement ou membre de cabinet ministériel';

create or replace table lobbying_defaults as
select o.id as organisation_id, d.period, trim(d.missing) as missing
from agora_defaults d
join lobbying_organisations o on o.identifier = d.identifier;

create or replace table lobbying_quarters as
select year(published_on::date) as year, quarter(published_on::date) as quarter,
    count(*) as activities
from lobbying_activities
where published_on::date <= getvariable('lobbying_as_of')
group by all;

create or replace table lobbying_recent as
select e.organisation_id, count(*) as activities
from lobbying_activities a
join lobbying_exercises e on e.id = a.exercise_id
where a.published_on::date > getvariable('lobbying_as_of') - interval '1 year'
    and a.published_on::date <= getvariable('lobbying_as_of')
group by e.organisation_id;

create or replace table lobbying_latest as
select * from lobbying_exercises
where ends_on::date <= getvariable('lobbying_as_of')
qualify row_number() over (partition by organisation_id order by ends_on desc, published_on desc, id desc) = 1;

create or replace table lobbying_crossrefs as
select l.id as organisation_id, o.siren, o.won_count as contracts,
    o.won_amount as contract_amount, o.grants_count as payments,
    o.grants_amount as payment_amount
from lobbying_organisations l
join orgs o using (siren)
where o.won_count > 0 or o.grants_count > 0;

create or replace table eu_lobbying as
with names as (
    select organisation_name(name) as normalized, any_value(siren) as siren
    from lobbying_organisations
    where upper(trim(country)) = 'FRANCE' and siren is not null
    group by all having count(*) = 1
), eu_names as (
    select organisation_name(name) as normalized from eu_register_raw
    group by all having count(*) = 1
)
select e.id, trim(e.name) as name, e.category,
    n.siren, e.start_date as starts_on, e.end_date as ends_on,
    case when e.currency = '€' then try_cast(nullif(e.cost_min, '') as double) end as cost_min,
    case when e.currency = '€' then try_cast(nullif(e.cost_max, '') as double) end as cost_max,
    case when e.currency = '€' then try_cast(nullif(e.cost_exact, '') as double) end as cost_exact,
    getvariable('eu_exported')::varchar as exported_at
from eu_register_raw e
left join eu_names en on en.normalized = organisation_name(e.name)
left join names n on n.normalized = en.normalized
where regexp_matches(lower(strip_accents(e.legal_form)),
    '(^|[^a-z])(sas|sasu|sa|sarl|eurl|sci|scop|scic|selarl|selas|snc|sca|scs|se|gie|gip|epic|epa|epci|asbl|aisbl|association|associations|fondation|federation|syndicat|societe|mutuelle|union|chambre|etablissement)([^a-z]|$)')
    and not regexp_matches(lower(strip_accents(e.legal_form)), 'individuel|independant|auto.entrepreneur|personne physique|self.employ');

create or replace table eu_lobbying_interests as
select distinct i.id as organisation_id, i.area
from eu_interests_raw i join eu_lobbying e using (id);
