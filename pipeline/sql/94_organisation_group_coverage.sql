insert into coverage
select source_id, count(*), 'Périmètre SNCF partiel au 31 décembre 2025, identifiants officiels'
from org_group_members where source_id like 'sncf-%' group by source_id
union all
select 'sncf-gares-identite', count(*), 'Identité SNCF Gares & Connexions, délibération du 25 septembre 2025'
from org_group_members where identifier_source_id = 'sncf-gares-identite';


insert into coverage
select 'gleif-entities', count(*), 'SIREN exacts Sirene ou Infogreffe, personnes morales du référentiel LEI'
from gleif_entity_input
union all
select 'gleif-relationships', count(*), 'Liens de consolidation ultime actifs publiés, avant rapprochement Sirene'
from gleif_ultimate_links
union all
select 'gleif-registration-authorities', 2, 'Codes RA000189 (Sirene) et RA000192 (Infogreffe) vérifiés';

insert into coverage_dates values
    ('gleif-entities', getvariable('gleif_as_of')),
    ('gleif-relationships', getvariable('gleif_as_of'));
