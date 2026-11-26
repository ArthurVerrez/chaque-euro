create or replace table legislative_files as select distinct * from legislative_files_raw;
create or replace table legislative_file_refs as select distinct * from legislative_file_refs_raw;
create or replace table legislative_events as
select * replace (row_number() over (partition by file_id order by source_order, id) as source_order)
from (select distinct * from legislative_events_raw);
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
        case
            when regexp_matches(t, 'resultats de la gestion|reglement du budget') then 'Loi de résultats'
            when contains(t, 'de finances de fin de gestion') then 'Loi de finances de fin de gestion'
            when contains(t, 'de financement rectificative de la securite sociale')
                then 'Financement rectificatif de la sécurité sociale'
            when contains(t, 'de financement de la securite sociale pour') then 'PLFSS'
            when contains(t, 'de finances rectificative') then 'Loi de finances rectificative'
            when regexp_matches(t, 'de finances pour 20[0-9]{2}') then 'PLF'
        end as law_kind,
        case when contains(t, 'securite sociale') then 'Sécurité sociale' else 'État' end,
        'Intitulé du dossier et année du titre'
    from (select *, strip_accents(lower(title_public)) as t from legislative_files)
    where regexp_matches(t, '^(projet de loi|loi n\S* ?[0-9-]+( du [0-9a-z]+ [a-z]+ [0-9]{4})?) '
            || '(relati[fv]e? aux resultats|de reglement|de finances|de financement)')
        and regexp_matches(title_public, '\b20\d{2}\b')
        and law_kind is not null
        and id not in (select file_id from budget_legislation_raw)
)
select distinct * from candidates;
