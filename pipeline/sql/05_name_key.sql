create or replace macro name_key(value) as
regexp_replace(upper(strip_accents(trim(value))), '[^A-Z0-9]', '', 'g');
