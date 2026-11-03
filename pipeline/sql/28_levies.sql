create or replace table levy_values as
select c.dataset, c.line, h.value::integer as year, trim(regexp_replace(l.value, '\s*\((\*+|[DP][0-9][0-9A-Za-z]*)\)', '', 'g')) as label,
    try_cast(c.value as double) * 1e9 as amount
from national_cells c
join national_cells h on h.dataset=c.dataset and h.line=3 and h.col=c.col
join national_cells l on l.dataset=c.dataset and l.line=c.line and l.col=1
where c.dataset in ('beneficiaries','taxes') and c.col>=2
    and try_cast(h.value as integer) is not null;

create or replace table compulsory_levies as
select 'beneficiary' as block,
    case when line=5 then 'TOTAL' else split_part(label, ' - ', 1) end as code,
    trim(split_part(label, ' - ', 2)) as label, year, amount
from levy_values where dataset='beneficiaries' and line in (5,6,7,10,11,12,15)
    and amount is not null
union all
select 'tax', 'row-' || line, trim(label), year, amount
from levy_values where dataset='taxes'
    and line in (5,11,15,17,40,41,51,54,71,72,75,78,93,99)
    and amount is not null
union all
select 'tax', 'TOTAL', 'Prélèvements obligatoires', year, amount
from levy_values where dataset='taxes' and line=110 and amount is not null;
