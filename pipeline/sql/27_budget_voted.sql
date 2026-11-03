create or replace table budget_voted as
with renames (previous, current) as (
    values ('Anciens combattants, mémoire et liens avec la Nation', 'Monde combattant, mémoire et liens avec la Nation')
)
select coalesce(b.mission, l.mission) as mission, l.voted
from lfi_missions l
left join renames r on r.current = l.mission
left join (select distinct mission from budget) b
    on lower(b.mission) = lower(coalesce(r.previous, l.mission));
