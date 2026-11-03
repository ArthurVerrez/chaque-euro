create or replace table state_assets as
select left(annee, 4)::integer as year,
    max(amount::double) filter (where categorie='Actif') as assets,
    max(amount::double) filter (where categorie='Passif') as liabilities,
    max(amount::double) filter (where categorie='Actif')
        - max(amount::double) filter (where categorie='Passif') as net_position,
    max(amount::double) filter (where categorie='Situation nette') as net_accounts,
    max(amount::double) filter (where categorie='Charges') as charges,
    max(amount::double) filter (where categorie='Produits') as products
from assets_raw group by annee;
