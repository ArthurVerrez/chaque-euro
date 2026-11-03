insert into coverage_dates
select 'jorfsimple', max(publication_date)::date from official_journals
union all select 'dole', max(source_modified_at)::date from legislative_files where source_id = 'dole';

insert into coverage_dates select * from document_snapshot_dates;
