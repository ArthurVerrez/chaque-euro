create or replace table expenses_raw (id varchar, institution varchar, role_kind varchar, territory_category varchar, effective_on varchar, measure varchar, amount_cents bigint, unit varchar, gross_net varchar, value_kind varchar, document_locator varchar, source_id varchar);

insert into expenses_raw values
    ('an-gross', 'Assemblée nationale', 'Député', 'Toutes', '2026-11-02', 'Indemnité parlementaire', 763739, 'par mois', 'brut', 'allowance', 'Situation matérielle, indemnité parlementaire', 'an-allowance'),
    ('an-dfp', 'Assemblée nationale', 'Député', 'Métropole', '2026-01-01', 'Dotation de fonctionnement parlementaire', 723804, 'par mois', 'sans objet', 'envelope', 'DFP, barème depuis le 1er janvier 2026', 'an-expense'),
    ('an-staff', 'Assemblée nationale', 'Député', 'Toutes', '2026-11-02', 'Crédit collaborateurs', 1146300, 'par mois', 'sans objet', 'envelope', 'Situation matérielle, crédit collaborateurs', 'an-allowance'),
    ('sen-gross', 'Sénat', 'Sénateur', 'Toutes', '2026-03-30', 'Indemnité parlementaire', 763739, 'par mois', 'brut', 'allowance', 'Page mise à jour le 30 mars 2026', 'senat-allowance'),
    ('sen-afm', 'Sénat', 'Sénateur', 'Régime général', '2025-01-20', 'Avance de frais de mandat', 660000, 'par mois', 'sans objet', 'envelope', 'Frais de mandat, régime général, majorations exclues', 'senat-expense'),
    ('sen-equipment', 'Sénat', 'Sénateur', 'Conditions de la page officielle', '2025-01-20', 'Équipement informatique et bureautique', 600000, 'sur trois ans', 'sans objet', 'envelope', 'Enveloppe dédiée, pas mensuelle', 'senat-expense'),
    ('sen-housing', 'Sénat', 'Sénateur', 'Hébergement parisien, sous conditions', '2025-01-20', 'Avance spécifique d''hébergement', 150000, 'par mois', 'sans objet', 'ceiling', 'Conditions et justificatifs : voir la source', 'senat-expense'),
    ('elysee-2024', 'Présidence de la République', 'Institution', 'France', '2024-12-31', 'Charges de l''exercice 2024', 12330000000, 'par an', 'sans objet', 'institutional_actual', 'Rapport Cour des comptes, exercice 2024, synthèse', 'presidency-accounts'),
    ('local-maire-0', 'Collectivités locales', 'Maire', 'Moins de 500 habitants', '2026-01-01', 'Barème ordinaire, hors majorations', 115506, 'par mois', 'brut', 'ceiling', 'Annexe 1, barème DGCL 2026', 'local-allowance'),
    ('local-maire-1', 'Collectivités locales', 'Maire', '500 à 999 habitants', '2026-01-01', 'Barème ordinaire, hors majorations', 182096, 'par mois', 'brut', 'ceiling', 'Annexe 1, barème DGCL 2026', 'local-allowance'),
    ('local-maire-2', 'Collectivités locales', 'Maire', '1 000 à 3 499 habitants', '2026-01-01', 'Barème ordinaire, hors majorations', 228956, 'par mois', 'brut', 'ceiling', 'Annexe 1, barème DGCL 2026', 'local-allowance'),
    ('local-maire-3', 'Collectivités locales', 'Maire', '3 500 à 9 999 habitants', '2026-01-01', 'Barème ordinaire, hors majorations', 239644, 'par mois', 'brut', 'ceiling', 'Annexe 1, barème DGCL 2026', 'local-allowance'),
    ('local-maire-4', 'Collectivités locales', 'Maire', '10 000 à 19 999 habitants', '2026-01-01', 'Barème ordinaire, hors majorations', 277871, 'par mois', 'brut', 'ceiling', 'Annexe 1, barème DGCL 2026', 'local-allowance'),
    ('local-maire-5', 'Collectivités locales', 'Maire', '20 000 à 49 999 habitants', '2026-01-01', 'Barème ordinaire, hors majorations', 369947, 'par mois', 'brut', 'ceiling', 'Annexe 1, barème DGCL 2026', 'local-allowance'),
    ('local-maire-6', 'Collectivités locales', 'Maire', '50 000 à 99 999 habitants', '2026-01-01', 'Barème ordinaire, hors majorations', 452158, 'par mois', 'brut', 'ceiling', 'Annexe 1, barème DGCL 2026', 'local-allowance'),
    ('local-maire-7', 'Collectivités locales', 'Maire', '100 000 et plus habitants', '2026-01-01', 'Barème ordinaire, hors majorations', 596026, 'par mois', 'brut', 'ceiling', 'Annexe 1, barème DGCL 2026', 'local-allowance'),
    ('local-adjointaumaire-0', 'Collectivités locales', 'Adjoint au maire', 'Moins de 500 habitants', '2026-01-01', 'Barème ordinaire, hors majorations', 44764, 'par mois', 'brut', 'ceiling', 'Annexe 1, barème DGCL 2026', 'local-allowance'),
    ('local-adjointaumaire-1', 'Collectivités locales', 'Adjoint au maire', '500 à 999 habitants', '2026-01-01', 'Barème ordinaire, hors majorations', 48381, 'par mois', 'brut', 'ceiling', 'Annexe 1, barème DGCL 2026', 'local-allowance'),
    ('local-adjointaumaire-2', 'Collectivités locales', 'Adjoint au maire', '1 000 à 3 499 habitants', '2026-01-01', 'Barème ordinaire, hors majorations', 87883, 'par mois', 'brut', 'ceiling', 'Annexe 1, barème DGCL 2026', 'local-allowance'),
    ('local-adjointaumaire-3', 'Collectivités locales', 'Adjoint au maire', '3 500 à 9 999 habitants', '2026-01-01', 'Barème ordinaire, hors majorations', 95857, 'par mois', 'brut', 'ceiling', 'Annexe 1, barème DGCL 2026', 'local-allowance'),
    ('local-adjointaumaire-4', 'Collectivités locales', 'Adjoint au maire', '10 000 à 19 999 habitants', '2026-01-01', 'Barème ordinaire, hors majorations', 117561, 'par mois', 'brut', 'ceiling', 'Annexe 1, barème DGCL 2026', 'local-allowance'),
    ('local-adjointaumaire-5', 'Collectivités locales', 'Adjoint au maire', '20 000 à 49 999 habitants', '2026-01-01', 'Barème ordinaire, hors majorations', 135647, 'par mois', 'brut', 'ceiling', 'Annexe 1, barème DGCL 2026', 'local-allowance'),
    ('local-adjointaumaire-6', 'Collectivités locales', 'Adjoint au maire', '50 000 à 99 999 habitants', '2026-01-01', 'Barème ordinaire, hors majorations', 180863, 'par mois', 'brut', 'ceiling', 'Annexe 1, barème DGCL 2026', 'local-allowance'),
    ('local-adjointaumaire-7', 'Collectivités locales', 'Adjoint au maire', '100 000 à 200 000 habitants', '2026-01-01', 'Barème ordinaire, hors majorations', 271295, 'par mois', 'brut', 'ceiling', 'Annexe 1, barème DGCL 2026', 'local-allowance'),
    ('local-adjointaumaire-8', 'Collectivités locales', 'Adjoint au maire', 'Plus de 200 000 habitants', '2026-01-01', 'Barème ordinaire, hors majorations', 298013, 'par mois', 'brut', 'ceiling', 'Annexe 1, barème DGCL 2026', 'local-allowance');

insert into expenses_raw values
    ('local-department-0','Collectivités locales','Conseiller départemental','Moins de 250 000 habitants','2026-01-01','Barème ordinaire, hors majorations',164421,'par mois','brut','ceiling','Annexe 2, barème DGCL 2026','local-allowance'),
    ('local-department-1','Collectivités locales','Conseiller départemental','250 000 à moins de 500 000 habitants','2026-01-01','Barème ordinaire, hors majorations',205526,'par mois','brut','ceiling','Annexe 2, barème DGCL 2026','local-allowance'),
    ('local-department-2','Collectivités locales','Conseiller départemental','500 000 à moins de 1 million d’habitants','2026-01-01','Barème ordinaire, hors majorations',246631,'par mois','brut','ceiling','Annexe 2, barème DGCL 2026','local-allowance'),
    ('local-department-3','Collectivités locales','Conseiller départemental','1 à moins de 1,25 million d’habitants','2026-01-01','Barème ordinaire, hors majorations',267184,'par mois','brut','ceiling','Annexe 2, barème DGCL 2026','local-allowance'),
    ('local-department-4','Collectivités locales','Conseiller départemental','1,25 million d’habitants et plus','2026-01-01','Barème ordinaire, hors majorations',287737,'par mois','brut','ceiling','Annexe 2, barème DGCL 2026','local-allowance'),
    ('local-region-0','Collectivités locales','Conseiller régional','Moins de 1 million d’habitants','2026-01-01','Barème ordinaire, hors majorations',164421,'par mois','brut','ceiling','Annexe 2, barème DGCL 2026','local-allowance'),
    ('local-region-1','Collectivités locales','Conseiller régional','1 à moins de 2 millions d’habitants','2026-01-01','Barème ordinaire, hors majorations',205526,'par mois','brut','ceiling','Annexe 2, barème DGCL 2026','local-allowance'),
    ('local-region-2','Collectivités locales','Conseiller régional','2 à moins de 3 millions d’habitants','2026-01-01','Barème ordinaire, hors majorations',246631,'par mois','brut','ceiling','Annexe 2, barème DGCL 2026','local-allowance'),
    ('local-region-3','Collectivités locales','Conseiller régional','3 millions d’habitants et plus','2026-01-01','Barème ordinaire, hors majorations',287737,'par mois','brut','ceiling','Annexe 2, barème DGCL 2026','local-allowance'),
    ('local-president-department','Collectivités locales','Président de conseil départemental','Toutes tailles','2026-01-01','Barème ordinaire, hors majorations',596026,'par mois','brut','ceiling','Annexe 2, barème DGCL 2026','local-allowance'),
    ('local-president-region','Collectivités locales','Président de conseil régional','Toutes tailles','2026-01-01','Barème ordinaire, hors majorations',596026,'par mois','brut','ceiling','Annexe 2, barème DGCL 2026','local-allowance');

create or replace table cabinets_raw (observed_on varchar, document_year integer, category varchar, value integer, unit varchar, document_locator varchar, source_id varchar);

insert into cabinets_raw values
    ('2025-07-01', 2026, 'Membres de cabinet', 521, 'personnes', 'Note de présentation, effectifs au 1er juillet 2025', 'cabinet-staff'),
    ('2025-07-01', 2026, 'Personnels de soutien', 2220, 'personnes', 'Note de présentation, effectifs au 1er juillet 2025', 'cabinet-staff');

