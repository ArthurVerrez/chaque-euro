create or replace table constituency_shapes as
with split_communes as (
    select insee from commune_constituencies group by insee having count(*) > 1
), bounds as (
    select g.insee,
        ST_Envelope(ST_Buffer(ST_Envelope(ST_GeomFromGeoJSON(g.geometry)), 0.01)) as geom
    from commune_geometries_raw g join split_communes s using(insee)
), clipped as (
    select c.insee, c.department_code, c.constituency,
        ST_Intersection(s.geom, b.geom) as geom
    from commune_constituencies c join bounds b using(insee)
    join constituency_shapes_raw s using(department_code, constituency)
)
select insee, department_code, constituency,
    ST_AsGeoJSON(ST_ReducePrecision(ST_SimplifyPreserveTopology(geom, 0.00001), 0.000001))
        as geometry,
    'insee-constituency-contours' as source_id
from clipped
where not ST_IsEmpty(geom) and ST_GeometryType(geom) in ('POLYGON', 'MULTIPOLYGON');
