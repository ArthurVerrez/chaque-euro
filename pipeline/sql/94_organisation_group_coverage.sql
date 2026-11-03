insert into coverage
select source_id, count(*), 'Périmètre SNCF partiel au 31 décembre 2025, identifiants officiels'
from org_group_members group by source_id
union all
select 'sncf-gares-identite', count(*), 'Identité SNCF Gares & Connexions, délibération du 25 septembre 2025'
from org_group_members where identifier_source_id = 'sncf-gares-identite';
