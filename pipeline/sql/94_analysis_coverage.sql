insert into coverage
select 'ofgl-financement-lille', count(*), 'Lille, exercices ' || min(year) || ' à ' || max(year)
from lille_financing
union all select 'ofgl-remboursement-marseille', count(*), 'Marseille, exercices ' || min(year) || ' à ' || max(year)
from marseille_repayments
union all select 'ofgl-ensemble-nantes', count(*), 'Ensemble nantais, exercices ' || min(year) || ' à ' || max(year)
from nantes_consolidation;

insert into coverage_dates
select 'ofgl-financement-lille', make_date(max(year), 12, 31) from lille_financing
union all select 'ofgl-remboursement-marseille', make_date(max(year), 12, 31) from marseille_repayments
union all select 'ofgl-ensemble-nantes', make_date(max(year), 12, 31) from nantes_consolidation;
