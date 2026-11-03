-- Names come from Sirene only. Natural persons and non-diffusible units are never named.
create or replace table needed_sirens as
select buyer_siren as siren from contract_rows where buyer_siren is not null
union
select holder_siren from contract_rows where holder_siren is not null
union
select siren from grant_rows where siren is not null
union
select buyer_id from boamp_input where buyer_id is not null
union
select siren_de_l_entite_acheteuse::varchar from approch_input
union
select siren from sanction_matches;

create or replace table units as
select
    siren,
    categorieJuridiqueUniteLegale::varchar as legal_category,
    statutDiffusionUniteLegale as diffusion,
    etatAdministratifUniteLegale = 'A' as active,
    coalesce(
        nullif(nullif(denominationUniteLegale, ''), '[ND]'),
        nullif(nullif(denominationUsuelle1UniteLegale, ''), '[ND]')
    ) as name
from read_parquet(getvariable('sirene_path'))
where siren in (select siren from needed_sirens);

create or replace table identities as
select
    siren,
    legal_category,
    active,
    case
        when legal_category = '1000' then 'Entrepreneur individuel'
        when diffusion <> 'O' or name is null then 'Nom non diffusé'
        else name
    end as label,
    coalesce(legal_category <> '1000' and diffusion = 'O' and name is not null, false) as public
from units;

create or replace macro holder_label(siren, label) as coalesce(
    label,
    case when siren is null then 'Titulaire sans SIREN' else 'Titulaire non identifié' end
);

create or replace macro org_kind(category) as case
    when category like '92%' then 'Association'
    when category like '93%' then 'Fondation'
    when category like '71%' then 'Administration de l''État'
    when category like '72%' then 'Collectivité territoriale'
    when category like '73%' then 'Établissement public administratif'
    when category like '74%' then 'Autre organisme public'
    when category like '4%' then 'Organisme public à caractère industriel et commercial'
    when category like '5%' then 'Société commerciale'
    when category like '6%' then 'Autre personne morale immatriculée au RCS'
    when category like '8%' then 'Organisme privé spécialisé'
    when category like '3%' then 'Personne morale de droit étranger'
    else 'Autre organisme'
end;
