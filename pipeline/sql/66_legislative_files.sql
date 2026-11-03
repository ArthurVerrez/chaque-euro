create or replace table legislative_files as select distinct * from legislative_files_raw;
create or replace table legislative_file_refs as select distinct * from legislative_file_refs_raw;
create or replace table legislative_events as select distinct * from legislative_events_raw;
create or replace table legislative_documents as select distinct * from legislative_documents_raw;
create or replace table budget_legislation as
with candidates as (
    select b.file_id, b.fiscal_year,
        case when contains(strip_accents(lower(f.title_public)), 'fin de gestion')
            then 'Loi de finances de fin de gestion' else b.law_kind end as law_kind,
        b.budget_family, b.match_method
    from budget_legislation_raw b join legislative_files f on f.id = b.file_id
    union all
    select id, list_last(regexp_extract_all(title_public, '\b20\d{2}\b'))::integer,
        'Loi de résultats', 'État', 'Dossier de loi et intitulé résultats ou règlement'
    from legislative_files
    where kind in ('Projet de loi ordinaire', 'PROJET_LOI', 'LOI_PUBLIEE')
        and regexp_matches(strip_accents(lower(title_public)),
            'resultats de la gestion|reglement du budget')
        and regexp_matches(title_public, '\b20\d{2}\b')
)
select distinct * from candidates;
