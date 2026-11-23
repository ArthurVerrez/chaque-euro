create or replace table lille_financing as
with accounts as (
    select exer::integer as year,
        max(montant) filter (where agregat = 'Emprunts hors GAD') as borrowing,
        max(montant) filter (where agregat = 'Remboursements d''emprunts hors GAD') as repayments,
        max(montant) filter (where agregat = 'Fonds de roulement') as working_capital
    from read_json(getvariable('lille_financing_path'), columns = {exer: 'varchar', agregat: 'varchar', montant: 'double'})
    group by year
), receipt_rows as (
    select regexp_split_to_array(trim(line), '\s{2,}') as cells
    from (select unnest(string_split(receipts_page, chr(10))) as line from lille_report)
), receipts as (
    select cells[1] as account, replace(replace(cells[4], ' ', ''), ',', '.')::double as amount
    from receipt_rows where cells[1] in ('1641', '16878', '165')
), city as (
    select 2025 as year,
        (select amount from receipts where account = '1641') as bank_loans,
        (select amount from receipts where account = '16878') as other_debt,
        (select amount from receipts where account = '165') as deposits,
        replace(regexp_extract(loans_page, '\(BEI\), à hauteur de ([0-9,]+) M€', 1), ',', '.')::double * 1e6 as eib_draw
    from lille_report
)
select a.*, c.bank_loans, c.other_debt, c.deposits, c.eib_draw
from accounts a left join city c using (year);
