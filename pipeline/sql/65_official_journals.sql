create or replace table official_texts as select distinct * from official_texts_raw;
create or replace table official_journals as
select j.*, count(t.id)::integer as public_text_count,
    case when j.missing_reference_count = 0 then 'Livraisons récentes complètes pour ce sommaire'
         else 'Références manquantes dans les livraisons récentes' end as coverage_status
from official_journals_raw j left join official_texts t on t.journal_id = j.id
group by all;
