create or replace macro rei_number(value) as try_cast(replace(trim(value), ',', '.') as double);

create or replace table rei_rows as
select
    trim(DEP) || lpad(trim(COM), case when length(trim(DEP)) = 3 then 2 else 3 end, '0') as insee,
    *
from read_csv(getvariable('rei_path'), delim = ';', header = true, all_varchar = true);

create or replace table commune_taxes as
select
    r.insee, 2025 as year, t.tax, t.authority, t.zone,
    case when t.authority = 'epci' and t.tax != 'teom' then
        case when t.tax = 'cfe' then coalesce(nullif(trim(SIREPT), ''), nullif(trim(SIREPCI), ''))
            else nullif(trim(SIREPCI), '') end end as authority_siren,
    case when t.authority = 'epci' and t.tax != 'teom' then
        case when t.tax = 'cfe' and nullif(trim(SIREPT), '') is not null then trim(LIBEPT)
            else trim(Q03) end end as authority_name,
    rei_number(t.base) as base, rei_number(t.rate) as rate,
    case when t.tax = 'ths' and t.authority = 'commune' then rei_number(TXMAJOTHRS) end as surtax_rate
from rei_rows r,
lateral (values
    ('tfb', 'commune', '', E11, E12),
    ('tfb', 'syndicat', '', E21, E22),
    ('tfb', 'epci', '', E31, E32),
    ('tfnb', 'commune', '', B11, B12),
    ('tfnb', 'syndicat', '', B21, B22),
    ('tfnb', 'epci', '', B31, B32),
    ('cfe', 'commune', '', P11, P12),
    ('cfe', 'syndicat', '', P21, P22),
    ('cfe', 'epci', 'Hors zone ou fiscalité additionnelle', P31_1, P32_1),
    ('cfe', 'epci', 'Fiscalité unique ou zone d’activité', P31_2, P32_2),
    ('cfe', 'epci', 'Zone éolienne', P31_3, P32_3),
    ('ths', 'commune', '', H11THS, H12),
    ('ths', 'syndicat', '', H21THS, H22),
    ('ths', 'epci', '', H31THS, H32),
    ('teom', case F71 when '1' then 'commune' when '2' then 'syndicat' when '3' then 'epci' end, 'Taux plein', F21, F22),
    ('teom', case F71 when '1' then 'commune' when '2' then 'syndicat' when '3' then 'epci' end, 'Zone A', F31, F32),
    ('teom', case F71 when '1' then 'commune' when '2' then 'syndicat' when '3' then 'epci' end, 'Zone B', F41, F42),
    ('teom', case F71 when '1' then 'commune' when '2' then 'syndicat' when '3' then 'epci' end, 'Zone C', F51, F52),
    ('teom', case F71 when '1' then 'commune' when '2' then 'syndicat' when '3' then 'epci' end, 'Zone D', F61, F62),
    ('teom', case F71 when '1' then 'commune' when '2' then 'syndicat' when '3' then 'epci' end, 'Zone E', F81, F82)
) t(tax, authority, zone, base, rate)
where t.authority is not null and (rei_number(t.base) > 0 or rei_number(t.rate) > 0);

create or replace table tax_strata as
select c.stratum, t.year, t.tax, t.authority, t.zone,
    case when count(*) >= 5 then median(t.rate) end as median_rate,
    case when count(*) >= 5 then median(t.base / nullif(c.population, 0)) end
        as median_base_per_capita,
    count(*) as communes
from commune_taxes t join communes c using (insee)
where t.base > 0 and t.rate is not null and c.year = t.year
group by all;
