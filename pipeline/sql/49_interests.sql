create or replace table interest_declarations as
select * from interests_raw where type in ('DI','DIM','DIA','DIAM') and official_status='Livrée';

create or replace table declared_interests as
select s.* from interest_sections_raw s join interest_declarations d on d.id=s.declaration_id;
