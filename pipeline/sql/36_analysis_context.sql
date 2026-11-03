create or replace table analysis_periods (label, start_year, end_year) as
values
    ('Vincent Auriol', 1947, 1954),
    ('René Coty', 1954, 1959),
    ('Charles de Gaulle', 1959, 1969),
    ('Georges Pompidou', 1969, 1974),
    ('Valéry Giscard d’Estaing', 1974, 1981),
    ('François Mitterrand', 1981, 1995),
    ('Jacques Chirac', 1995, 2007),
    ('Nicolas Sarkozy', 2007, 2012),
    ('François Hollande', 2012, 2017),
    ('Emmanuel Macron', 2017, 2026);

create or replace table analysis_events (label, start_year, end_year) as
values
    ('Récession', 1993, 1993),
    ('Crise financière', 2008, 2009),
    ('Covid-19', 2020, 2021),
    ('Crise énergétique', 2022, 2022);
