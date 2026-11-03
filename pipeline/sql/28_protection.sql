create or replace table social_benefits as
select left(h.value, 4)::integer as year,
    case when c.line=2 then 'TOTAL' else l.value end as risk,
    c.value::double * 1e6 as amount
from national_cells c
join national_cells h on h.dataset=c.dataset and h.line=1 and h.col=c.col
join national_cells l on l.dataset=c.dataset and l.line=c.line and l.col=0
where c.dataset='protection' and c.line in (2,3,87,146,189,221,239)
    and c.col>0;
