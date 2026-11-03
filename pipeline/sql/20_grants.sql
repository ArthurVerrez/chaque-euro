create or replace table grant_rows as
select
    case when regexp_full_match(trim(siren), '[0-9]{9}') then trim(siren) end as siren,
    trim(programme) as programme_code,
    try_cast(montant as double) as amount,
    nullif(trim(regexp_replace("Objet 2025", '[\s\x{00a0}]+', ' ', 'g')), '') as purpose,
    2025 as year
from read_xlsx(getvariable('jaune_path'), header = true, all_varchar = true)
where try_cast(montant as double) is not null;
