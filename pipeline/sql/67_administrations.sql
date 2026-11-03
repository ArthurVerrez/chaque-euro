create or replace table administrations as
select * from administrations_raw
qualify row_number() over (partition by id order by source_id = 'roae' desc) = 1;
create or replace table administration_relations as
select distinct r.* from administration_relations_raw r
join administrations p on p.id = r.parent_id
join administrations c on c.id = r.child_id;

create or replace table administration_pivots as
select distinct p.* from administration_pivots_raw p join administrations a on a.id = p.administration_id;
create or replace table administration_coverage as
select distinct c.* from administration_coverage_raw c join administrations a on a.id = c.administration_id;
