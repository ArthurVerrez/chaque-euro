CREATE TABLE build (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  short_name TEXT NOT NULL,
  name TEXT NOT NULL,
  publisher TEXT NOT NULL,
  page_url TEXT NOT NULL,
  file_url TEXT,
  record_url TEXT,
  code_url TEXT,
  licence_name TEXT NOT NULL,
  licence_url TEXT NOT NULL,
  frequency TEXT NOT NULL,
  usage TEXT NOT NULL,
  limits TEXT NOT NULL,
  retrieved_at TEXT,
  published_at TEXT,
  coverage TEXT,
  rows INTEGER,
  sha256 TEXT,
  value REAL,
  data_date TEXT,
  freshness_retrieval_days INTEGER NOT NULL,
  freshness_data_days INTEGER NOT NULL,
  checked_at TEXT,
  refresh_error TEXT,
  download_expected INTEGER NOT NULL
);

CREATE TABLE source_urls (source_id TEXT NOT NULL, url TEXT NOT NULL);
CREATE INDEX source_urls_source ON source_urls (source_id);

CREATE TABLE orgs (
  siren TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  legal_category TEXT,
  activity TEXT,
  active INTEGER NOT NULL,
  won_amount REAL NOT NULL,
  won_count INTEGER NOT NULL,
  won_unpriced INTEGER NOT NULL,
  won_estimated INTEGER NOT NULL,
  awarded_amount REAL NOT NULL,
  awarded_count INTEGER NOT NULL,
  awarded_unpriced INTEGER NOT NULL,
  awarded_estimated INTEGER NOT NULL,
  grants_amount REAL NOT NULL,
  grants_count INTEGER NOT NULL
);

CREATE INDEX orgs_won_amount ON orgs (won_amount);
CREATE INDEX orgs_awarded_amount ON orgs (awarded_amount);
CREATE INDEX orgs_grants_amount ON orgs (grants_amount);

CREATE TABLE org_years (
  siren TEXT NOT NULL,
  role TEXT NOT NULL,
  year INTEGER NOT NULL,
  amount REAL NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (siren, role, year)
) WITHOUT ROWID;

CREATE TABLE org_counterparts (
  siren TEXT NOT NULL,
  role TEXT NOT NULL,
  rank INTEGER NOT NULL,
  counterpart_siren TEXT,
  counterpart_name TEXT NOT NULL,
  amount REAL NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (siren, role, rank)
) WITHOUT ROWID;

CREATE TABLE source_files (id INTEGER PRIMARY KEY, url TEXT NOT NULL);

CREATE TABLE contracts (
  id INTEGER PRIMARY KEY,
  uid TEXT NOT NULL,
  buyer_siren TEXT,
  subject TEXT,
  amount REAL,
  amount_flag TEXT,
  declared_amount REAL,
  amount_estimated INTEGER NOT NULL,
  amount_counted INTEGER NOT NULL,
  holders INTEGER NOT NULL,
  holders_label TEXT NOT NULL,
  notified_on TEXT,
  source_file_id INTEGER
);

CREATE TABLE org_contracts (
  siren TEXT NOT NULL,
  role TEXT NOT NULL,
  contract_id INTEGER NOT NULL,
  PRIMARY KEY (siren, role, contract_id)
) WITHOUT ROWID;

CREATE TABLE grants (
  id INTEGER PRIMARY KEY,
  siren TEXT NOT NULL,
  year INTEGER NOT NULL,
  programme_code TEXT,
  programme_label TEXT,
  amount REAL NOT NULL,
  purpose TEXT
);
CREATE INDEX grants_siren ON grants (siren);

CREATE TABLE budget (
  programme_code TEXT PRIMARY KEY,
  mission TEXT NOT NULL,
  programme TEXT NOT NULL,
  spent REAL NOT NULL,
  personnel REAL NOT NULL,
  voted REAL NOT NULL
);

CREATE TABLE revenue (
  category TEXT NOT NULL,
  section_code TEXT NOT NULL,
  section TEXT NOT NULL,
  amount REAL NOT NULL
);

CREATE TABLE budget_voted (
  mission TEXT PRIMARY KEY,
  voted REAL NOT NULL
);

CREATE TABLE public_finances (
  sector TEXT NOT NULL,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  spending REAL NOT NULL,
  revenue REAL NOT NULL,
  PRIMARY KEY (sector, year)
);

CREATE TABLE public_accounts (
  sector TEXT NOT NULL,
  block TEXT NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  year INTEGER NOT NULL,
  amount REAL NOT NULL,
  PRIMARY KEY (sector, block, code, year)
);

CREATE TABLE public_functions (
  sector TEXT NOT NULL,
  function TEXT NOT NULL,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  spending REAL NOT NULL,
  PRIMARY KEY (sector, function, year)
);

CREATE TABLE communes (
  insee TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department_code TEXT,
  department_name TEXT,
  region_name TEXT,
  siren TEXT,
  population INTEGER,
  stratum TEXT,
  year INTEGER NOT NULL
);
CREATE INDEX communes_siren ON communes (siren);
CREATE INDEX communes_population ON communes (population);
CREATE INDEX communes_department ON communes (department_code);

CREATE TABLE finance_items (
  item TEXT PRIMARY KEY,
  aggregate TEXT NOT NULL,
  label TEXT NOT NULL,
  section TEXT NOT NULL,
  sort INTEGER NOT NULL
);

CREATE TABLE commune_years (
  insee TEXT NOT NULL,
  year INTEGER NOT NULL,
  population INTEGER,
  stratum TEXT,
  PRIMARY KEY (insee, year)
) WITHOUT ROWID;

CREATE TABLE commune_finances (
  insee TEXT NOT NULL,
  year INTEGER NOT NULL,
  item TEXT NOT NULL,
  amount REAL NOT NULL,
  per_capita REAL,
  PRIMARY KEY (insee, year, item)
) WITHOUT ROWID;

CREATE TABLE strata (
  stratum TEXT NOT NULL,
  label TEXT NOT NULL,
  year INTEGER NOT NULL,
  item TEXT NOT NULL,
  median_per_capita REAL,
  communes INTEGER NOT NULL,
  PRIMARY KEY (stratum, year, item)
) WITHOUT ROWID;

CREATE TABLE departements (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  communes INTEGER NOT NULL,
  population INTEGER NOT NULL,
  spending REAL NOT NULL,
  per_capita REAL NOT NULL,
  year INTEGER NOT NULL,
  path TEXT NOT NULL,
  outline TEXT NOT NULL,
  viewbox TEXT NOT NULL,
  label_x INTEGER NOT NULL,
  label_y INTEGER NOT NULL,
  label_size INTEGER NOT NULL
);

CREATE TABLE commune_shapes (
  insee TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  cx INTEGER NOT NULL,
  cy INTEGER NOT NULL
);

CREATE TABLE downloads (
  file TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  format TEXT NOT NULL,
  description TEXT NOT NULL,
  rows INTEGER NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL
);

CREATE TABLE facts (
  key TEXT PRIMARY KEY,
  value REAL NOT NULL,
  period TEXT NOT NULL,
  source_ids TEXT NOT NULL
);

CREATE TABLE timeline (
  series TEXT NOT NULL,
  year INTEGER NOT NULL,
  value REAL NOT NULL,
  PRIMARY KEY (series, year)
) WITHOUT ROWID;

CREATE VIRTUAL TABLE search USING fts5 (
  name,
  kind UNINDEXED,
  ref UNINDEXED,
  detail UNINDEXED,
  weight UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE deficit_series (
  year INTEGER PRIMARY KEY,
  apu_balance REAL NOT NULL, apu_ratio REAL NOT NULL,
  state_balance REAL, state_ratio REAL,
  apu_debt REAL, apu_debt_ratio REAL,
  state_debt REAL, state_debt_ratio REAL,
  budget_balance REAL, budget_ratio REAL
);
CREATE TABLE eu_flows (
  year INTEGER PRIMARY KEY,
  expenditure REAL NOT NULL, contribution REAL NOT NULL,
  ngeu REAL NOT NULL, customs REAL,
  population REAL NOT NULL, balance REAL NOT NULL, per_capita REAL NOT NULL
);
CREATE TABLE eu_headings (
  year INTEGER NOT NULL, code TEXT NOT NULL, label TEXT NOT NULL, amount REAL NOT NULL,
  PRIMARY KEY (year, code)
);
CREATE TABLE paris_comparison (
  city TEXT PRIMARY KEY, year INTEGER NOT NULL,
  population REAL NOT NULL, per_capita REAL NOT NULL, spending REAL NOT NULL
);
CREATE TABLE paris_context (metric TEXT PRIMARY KEY, year INTEGER NOT NULL, amount REAL NOT NULL);
CREATE TABLE rail_transfers (
  year INTEGER PRIMARY KEY, operating REAL NOT NULL, investment REAL NOT NULL, total REAL NOT NULL
);
CREATE TABLE rail_revenue (
  year INTEGER NOT NULL, service TEXT NOT NULL,
  commercial REAL NOT NULL, public REAL NOT NULL, total REAL NOT NULL,
  PRIMARY KEY (year, service)
);
CREATE TABLE rail_context (metric TEXT NOT NULL, year INTEGER NOT NULL, amount REAL NOT NULL, PRIMARY KEY (metric, year));
CREATE TABLE student_scholarships (year INTEGER PRIMARY KEY, recipients INTEGER NOT NULL, share REAL NOT NULL);
CREATE TABLE student_budget (year INTEGER NOT NULL, stage TEXT NOT NULL, programme TEXT NOT NULL, amount REAL NOT NULL, PRIMARY KEY (year, programme));
CREATE TABLE student_cost (metric TEXT PRIMARY KEY, year INTEGER NOT NULL, amount REAL NOT NULL);
CREATE TABLE analysis_periods (label TEXT NOT NULL, start_year INTEGER PRIMARY KEY, end_year INTEGER NOT NULL);
CREATE TABLE analysis_events (label TEXT NOT NULL, start_year INTEGER PRIMARY KEY, end_year INTEGER NOT NULL);

CREATE TABLE rail_network (year INTEGER PRIMARY KEY, eu REAL NOT NULL, state REAL NOT NULL, local_other REAL NOT NULL, total REAL NOT NULL);

CREATE TABLE state_monthly (
  year INTEGER NOT NULL, month INTEGER NOT NULL, spending REAL NOT NULL,
  revenue REAL NOT NULL, balance REAL NOT NULL, transfers REAL NOT NULL,
  funds REAL NOT NULL, special REAL NOT NULL, annex REAL NOT NULL,
  PRIMARY KEY (year, month)
);
CREATE TABLE state_titles (year INTEGER NOT NULL, code TEXT NOT NULL, label TEXT NOT NULL, amount REAL NOT NULL, PRIMARY KEY (year, code));
CREATE TABLE state_ministries (year INTEGER NOT NULL, ministry TEXT NOT NULL, amount REAL NOT NULL, PRIMARY KEY (year, ministry));
CREATE TABLE state_assets (year INTEGER PRIMARY KEY, assets REAL NOT NULL, liabilities REAL NOT NULL, net_position REAL NOT NULL, net_accounts REAL NOT NULL, charges REAL NOT NULL, products REAL NOT NULL);
CREATE TABLE compulsory_levies (block TEXT NOT NULL, code TEXT NOT NULL, label TEXT NOT NULL, year INTEGER NOT NULL, amount REAL NOT NULL, PRIMARY KEY (block, code, year));
CREATE TABLE european_finances (geo TEXT NOT NULL, year INTEGER NOT NULL, spending REAL NOT NULL, revenue REAL NOT NULL, balance REAL NOT NULL, debt REAL NOT NULL, status TEXT, PRIMARY KEY (geo, year));
CREATE TABLE european_functions (geo TEXT NOT NULL, year INTEGER NOT NULL, function TEXT NOT NULL, spending REAL NOT NULL, status TEXT, PRIMARY KEY (geo, year, function));
CREATE TABLE quarterly_debt (period TEXT PRIMARY KEY, amount REAL NOT NULL, ratio REAL NOT NULL, status TEXT);
CREATE TABLE social_benefits (year INTEGER NOT NULL, risk TEXT NOT NULL, amount REAL NOT NULL, PRIMARY KEY (year, risk));
CREATE TABLE green_budget (year INTEGER NOT NULL, rating TEXT NOT NULL, amount REAL NOT NULL, PRIMARY KEY (year, rating));

CREATE TABLE social_branches (
  source_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  branch TEXT NOT NULL,
  label TEXT NOT NULL,
  stage TEXT NOT NULL,
  revenue REAL NOT NULL,
  spending REAL NOT NULL,
  balance REAL NOT NULL,
  PRIMARY KEY (source_id, year, branch)
) WITHOUT ROWID;

CREATE TABLE social_ondam (
  year INTEGER NOT NULL,
  stage TEXT NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  amount REAL NOT NULL,
  PRIMARY KEY (year, code)
) WITHOUT ROWID;

CREATE TABLE health_payers (
  year INTEGER NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  amount REAL NOT NULL,
  PRIMARY KEY (year, code)
) WITHOUT ROWID;

CREATE TABLE pension_indicators (
  year INTEGER NOT NULL,
  sex TEXT NOT NULL,
  recipients INTEGER NOT NULL,
  monthly_pension REAL NOT NULL,
  PRIMARY KEY (year, sex)
) WITHOUT ROWID;

CREATE TABLE family_benefits (
  year INTEGER NOT NULL,
  label TEXT NOT NULL,
  amount REAL NOT NULL,
  PRIMARY KEY (year, label)
) WITHOUT ROWID;

CREATE TABLE unemployment_accounts (
  year INTEGER PRIMARY KEY,
  revenue REAL NOT NULL,
  spending REAL NOT NULL,
  balance REAL NOT NULL,
  exceptional REAL NOT NULL,
  financial_balance REAL NOT NULL,
  benefits REAL NOT NULL,
  employment_services REAL NOT NULL,
  debt REAL NOT NULL
);


CREATE TABLE procurement_breakdown (
  dimension TEXT NOT NULL, label TEXT NOT NULL, count INTEGER NOT NULL,
  priced INTEGER NOT NULL, amount REAL NOT NULL, estimated INTEGER NOT NULL, PRIMARY KEY (dimension, label)
) WITHOUT ROWID;
CREATE TABLE procurement_quality (
  year INTEGER NOT NULL, category TEXT NOT NULL, total INTEGER NOT NULL,
  eligible INTEGER NOT NULL, valid INTEGER NOT NULL, on_time INTEGER NOT NULL,
  PRIMARY KEY (year, category)
) WITHOUT ROWID;
CREATE TABLE procurement_latest (
  id INTEGER PRIMARY KEY, uid TEXT NOT NULL, buyer_siren TEXT, subject TEXT,
  amount REAL, amount_flag TEXT, declared_amount REAL,
  amount_estimated INTEGER NOT NULL, amount_counted INTEGER NOT NULL,
  holders INTEGER NOT NULL, holders_label TEXT NOT NULL,
  notified_on TEXT, source_file_id INTEGER
);
CREATE TABLE procurement_notices (
  id TEXT PRIMARY KEY, subject TEXT, published_on TEXT, deadline TEXT NOT NULL,
  procedure TEXT, buyer_siren TEXT, buyer_name TEXT NOT NULL, estimated_range TEXT
);
CREATE INDEX procurement_notices_buyer ON procurement_notices (buyer_siren, deadline);
CREATE TABLE procurement_projects (
  id TEXT PRIMARY KEY, subject TEXT, expected_on TEXT NOT NULL, category TEXT,
  procedure TEXT, estimated_range TEXT, buyer_siren TEXT, buyer_name TEXT NOT NULL
);
CREATE INDEX procurement_projects_buyer ON procurement_projects (buyer_siren, expected_on);
CREATE TABLE competition_decisions (
  id TEXT PRIMARY KEY, year INTEGER NOT NULL, amount REAL NOT NULL, company_rows INTEGER NOT NULL
);
CREATE TABLE competition_companies (
  id INTEGER PRIMARY KEY, decision_id TEXT NOT NULL, siren TEXT, name TEXT NOT NULL, amount REAL
);
CREATE INDEX competition_companies_decision ON competition_companies (decision_id);


CREATE TABLE lobbying_organisations (id TEXT PRIMARY KEY, identifier TEXT NOT NULL UNIQUE, siren TEXT, name TEXT NOT NULL, country TEXT, category TEXT, active INTEGER NOT NULL);
CREATE INDEX lobbying_organisations_siren ON lobbying_organisations (siren);
CREATE TABLE lobbying_exercises (id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL, starts_on TEXT NOT NULL, ends_on TEXT NOT NULL, published_on TEXT NOT NULL, activities INTEGER NOT NULL, declared_activities INTEGER NOT NULL, activities_reconciled INTEGER NOT NULL, budget_label TEXT, budget_min REAL, budget_max REAL);
CREATE INDEX lobbying_exercises_organisation ON lobbying_exercises (organisation_id);
CREATE TABLE lobbying_activities (id TEXT PRIMARY KEY, exercise_id TEXT NOT NULL, published_on TEXT NOT NULL);
CREATE INDEX lobbying_activities_exercise ON lobbying_activities (exercise_id);
CREATE TABLE lobbying_targets (activity_id TEXT NOT NULL, kind TEXT NOT NULL, label TEXT NOT NULL, PRIMARY KEY (activity_id, kind, label));
CREATE TABLE lobbying_defaults (organisation_id TEXT PRIMARY KEY, period TEXT NOT NULL, missing TEXT NOT NULL);
CREATE TABLE lobbying_quarters (year INTEGER NOT NULL, quarter INTEGER NOT NULL, activities INTEGER NOT NULL, PRIMARY KEY (year, quarter));
CREATE TABLE lobbying_recent (organisation_id TEXT PRIMARY KEY, activities INTEGER NOT NULL);
CREATE TABLE lobbying_latest (id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL UNIQUE, starts_on TEXT NOT NULL, ends_on TEXT NOT NULL, published_on TEXT NOT NULL, activities INTEGER NOT NULL, declared_activities INTEGER NOT NULL, activities_reconciled INTEGER NOT NULL, budget_label TEXT, budget_min REAL, budget_max REAL);
CREATE TABLE lobbying_crossrefs (organisation_id TEXT PRIMARY KEY, siren TEXT NOT NULL, contracts INTEGER NOT NULL, contract_amount REAL NOT NULL, payments INTEGER NOT NULL, payment_amount REAL NOT NULL);
CREATE TABLE eu_lobbying (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, siren TEXT, starts_on TEXT, ends_on TEXT, cost_min REAL, cost_max REAL, cost_exact REAL, exported_at TEXT NOT NULL);
CREATE INDEX eu_lobbying_siren ON eu_lobbying (siren);
CREATE TABLE eu_lobbying_interests (organisation_id TEXT NOT NULL, area TEXT NOT NULL, PRIMARY KEY (organisation_id, area));
CREATE TABLE party_accounts (code TEXT NOT NULL, name TEXT NOT NULL, year INTEGER NOT NULL, members REAL NOT NULL, elected REAL NOT NULL, donations REAL NOT NULL, public_first REAL NOT NULL, public_second REAL NOT NULL, public_other REAL NOT NULL, resources REAL NOT NULL, public_aid REAL NOT NULL, other_resources REAL NOT NULL, component_difference REAL NOT NULL, reconciled INTEGER NOT NULL, majority_public INTEGER NOT NULL, PRIMARY KEY (code, year));
CREATE TABLE party_aid_losses (code TEXT PRIMARY KEY, name TEXT NOT NULL, exercise INTEGER NOT NULL, decision TEXT NOT NULL, reason TEXT NOT NULL, until_date TEXT NOT NULL);


CREATE TABLE official_journals (id TEXT, publication_date TEXT, issue_number TEXT, source_reference_count INTEGER, excluded_reference_count INTEGER, missing_reference_count INTEGER, source_file TEXT, public_text_count INTEGER, coverage_status TEXT, PRIMARY KEY (id));
CREATE TABLE official_texts (id TEXT, journal_id TEXT, publication_date TEXT, nature TEXT, title_public TEXT, nor TEXT, ministry_label TEXT, authority_label TEXT, appointment_class TEXT, classification_version TEXT, record_url TEXT, source_file TEXT, PRIMARY KEY (id));
CREATE TABLE legislative_files (id TEXT, title_public TEXT, kind TEXT, legislature TEXT, status TEXT, source_id TEXT, source_modified_at TEXT, record_url TEXT, PRIMARY KEY (id));
CREATE TABLE legislative_file_refs (file_id TEXT, source_id TEXT, external_id TEXT, record_url TEXT, source_status TEXT, source_file TEXT, PRIMARY KEY (file_id, source_id, external_id));
CREATE TABLE legislative_events (id TEXT, file_id TEXT, parent_id TEXT, chamber TEXT, label_public TEXT, event_at TEXT, temporal_status TEXT, outcome TEXT, source_order INTEGER, record_url TEXT, source_id TEXT, PRIMARY KEY (id));
CREATE TABLE legislative_documents (id TEXT, file_id TEXT, event_id TEXT, kind TEXT, title_public TEXT, record_url TEXT, source_id TEXT, PRIMARY KEY (id));
CREATE TABLE budget_legislation (file_id TEXT, fiscal_year INTEGER, law_kind TEXT, budget_family TEXT, match_method TEXT, PRIMARY KEY (file_id, fiscal_year, law_kind));
CREATE TABLE administrations (id TEXT, name_public TEXT, acronym TEXT, category TEXT, organism_type TEXT, siren TEXT, commune_code TEXT, record_url TEXT, source_modified_at TEXT, source_id TEXT, head_name TEXT, head_role TEXT, PRIMARY KEY (id));
CREATE TABLE administration_relations (parent_id TEXT, child_id TEXT, relation_type TEXT, source_id TEXT, PRIMARY KEY (parent_id, child_id, relation_type, source_id));
CREATE INDEX official_texts_publication ON official_texts (publication_date, nature, ministry_label);
CREATE INDEX legislative_events_file ON legislative_events (file_id);
CREATE INDEX administration_relations_child ON administration_relations (child_id);

CREATE TABLE administration_pivots (administration_id TEXT, pivot_code TEXT, commune_code TEXT, PRIMARY KEY (administration_id, pivot_code, commune_code));
CREATE TABLE administration_coverage (commune_code TEXT, pivot_code TEXT, administration_id TEXT, PRIMARY KEY (commune_code, pivot_code, administration_id));
CREATE INDEX administration_coverage_service ON administration_coverage (administration_id);

CREATE TABLE procurement_competition (
  dimension TEXT NOT NULL, label TEXT NOT NULL, total INTEGER NOT NULL,
  known INTEGER NOT NULL, single_bid INTEGER NOT NULL, PRIMARY KEY (dimension, label)
) WITHOUT ROWID;

CREATE TABLE local_accounts (
  level TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  siren TEXT NOT NULL,
  category TEXT NOT NULL,
  year INTEGER NOT NULL,
  population INTEGER,
  spending REAL,
  operating REAL,
  investment REAL,
  revenue REAL,
  debt REAL,
  spending_per_capita REAL,
  revenue_per_capita REAL,
  debt_per_capita REAL,
  PRIMARY KEY (level, siren, year)
);
CREATE INDEX local_accounts_code ON local_accounts (level, code, year);

CREATE TABLE commune_taxes (
  insee TEXT NOT NULL,
  year INTEGER NOT NULL,
  tax TEXT NOT NULL,
  authority TEXT NOT NULL,
  zone TEXT NOT NULL,
  authority_siren TEXT,
  authority_name TEXT,
  base REAL,
  rate REAL,
  surtax_rate REAL,
  PRIMARY KEY (insee, year, tax, authority, zone)
);

CREATE TABLE tax_strata (
  stratum TEXT NOT NULL,
  year INTEGER NOT NULL,
  tax TEXT NOT NULL,
  authority TEXT NOT NULL,
  zone TEXT NOT NULL,
  median_rate REAL,
  median_base_per_capita REAL,
  communes INTEGER NOT NULL,
  PRIMARY KEY (stratum, year, tax, authority, zone)
);

CREATE TABLE commune_income (
  insee TEXT PRIMARY KEY,
  revenue_year INTEGER NOT NULL,
  households INTEGER,
  taxable_households INTEGER,
  reference_income REAL,
  net_tax REAL
);

CREATE TABLE commune_turnout (
  source_id TEXT NOT NULL,
  insee TEXT NOT NULL,
  department_code TEXT NOT NULL,
  registered INTEGER,
  voters INTEGER,
  turnout REAL,
  excluded_communes INTEGER NOT NULL,
  PRIMARY KEY (insee, source_id)
);

CREATE TABLE department_turnout (
  source_id TEXT NOT NULL,
  department_code TEXT NOT NULL,
  registered INTEGER,
  voters INTEGER,
  turnout REAL,
  communes INTEGER NOT NULL,
  excluded_communes INTEGER NOT NULL,
  PRIMARY KEY (department_code, source_id)
);

CREATE TABLE commune_dgf_history (
  year INTEGER PRIMARY KEY,
  amount REAL NOT NULL,
  communes INTEGER NOT NULL
);

CREATE TABLE public_people (
  id TEXT,
  given_name TEXT,
  family_name TEXT,
  display_name TEXT,
  role_kind TEXT,
  chamber TEXT,
  territory_code TEXT,
  territory_label TEXT,
  group_label TEXT,
  active INTEGER,
  hatvp_ref TEXT,
  source_id TEXT
);

CREATE TABLE public_organs (
  chamber TEXT,
  external_id TEXT,
  kind TEXT,
  label TEXT,
  short_label TEXT,
  starts_on TEXT,
  ends_on TEXT,
  source_id TEXT
);

CREATE TABLE public_mandates (
  id TEXT,
  person_id TEXT,
  kind TEXT,
  chamber TEXT,
  organ_id TEXT,
  territory_code TEXT,
  territory_label TEXT,
  role_label TEXT,
  starts_on TEXT,
  ends_on TEXT,
  date_precision TEXT,
  source_id TEXT
);

CREATE TABLE public_ballots (
  id TEXT,
  chamber TEXT,
  number INTEGER,
  session TEXT,
  voted_on TEXT,
  title TEXT,
  result TEXT,
  for_count INTEGER,
  against_count INTEGER,
  abstention_count INTEGER,
  non_voting_count INTEGER,
  announced_for INTEGER,
  announced_against INTEGER,
  source_id TEXT
);

CREATE TABLE public_votes (
  ballot_id TEXT,
  person_id TEXT,
  position TEXT,
  group_id TEXT,
  delegated INTEGER,
  source_status TEXT,
  source_id TEXT
);

CREATE TABLE public_vote_corrections (
  ballot_id TEXT,
  ordinal INTEGER,
  person_id TEXT,
  intended_position TEXT,
  source_id TEXT
);

CREATE TABLE public_person_metrics (
  person_id TEXT,
  window_kind TEXT,
  window_start TEXT,
  window_end TEXT,
  numerator INTEGER,
  denominator INTEGER,
  value REAL,
  source_id TEXT
);

CREATE TABLE interest_declarations (
  id TEXT,
  person_id TEXT,
  type TEXT,
  modifying INTEGER,
  filed_on TEXT,
  published_on TEXT,
  official_status TEXT,
  document TEXT,
  source_id TEXT
);

CREATE TABLE declared_interests (
  declaration_id TEXT,
  section TEXT,
  item_count INTEGER,
  explicitly_none INTEGER,
  source_id TEXT
);

CREATE TABLE campaign_accounts (
  election_id TEXT,
  candidate_id TEXT,
  candidate_name TEXT,
  territory_code TEXT,
  constituency TEXT,
  decision_code TEXT,
  decision_label TEXT,
  declared_expenses_cents INTEGER,
  retained_expenses_cents INTEGER,
  declared_revenue_cents INTEGER,
  retained_revenue_cents INTEGER,
  personal_contribution_cents INTEGER,
  donations_cents INTEGER,
  party_contribution_cents INTEGER,
  in_kind_cents INTEGER,
  rfe_fixed_cents INTEGER,
  transport_fixed_cents INTEGER,
  devolution_cents INTEGER,
  published_on TEXT,
  source_id TEXT
);

CREATE TABLE campaign_account_lines (
  election_id TEXT,
  candidate_id TEXT,
  ordinal INTEGER,
  basis TEXT,
  category TEXT,
  amount_cents INTEGER,
  source_id TEXT
);

CREATE TABLE campaign_decisions (
  id TEXT,
  candidate_name TEXT,
  territory_label TEXT,
  document TEXT,
  rectifies_id TEXT,
  coverage_status TEXT,
  source_id TEXT
);

CREATE TABLE rne_statistics (
  mandate_kind TEXT,
  department_code TEXT,
  sex TEXT,
  age_band TEXT,
  records INTEGER,
  data_date TEXT,
  source_id TEXT
);

CREATE TABLE local_executives (
  id TEXT,
  display_name TEXT,
  role_label TEXT,
  territory_code TEXT,
  territory_label TEXT,
  department_code TEXT,
  starts_on TEXT,
  data_date TEXT,
  source_id TEXT
);

CREATE TABLE cada_opinions (
  dossier_id TEXT,
  kind TEXT,
  session_on TEXT,
  favorable INTEGER,
  unfavorable INTEGER,
  other INTEGER,
  source_id TEXT
);

CREATE TABLE expense_reference_values (
  id TEXT,
  institution TEXT,
  role_kind TEXT,
  territory_category TEXT,
  effective_on TEXT,
  measure TEXT,
  amount_cents INTEGER,
  unit TEXT,
  gross_net TEXT,
  value_kind TEXT,
  document_locator TEXT,
  source_id TEXT
);

CREATE TABLE cabinet_statistics (
  observed_on TEXT,
  document_year INTEGER,
  category TEXT,
  value INTEGER,
  unit TEXT,
  document_locator TEXT,
  source_id TEXT
);

CREATE TABLE transparency_alerts (
  id TEXT,
  election_id TEXT,
  candidate_id TEXT,
  candidate_name TEXT,
  territory_code TEXT,
  rule TEXT,
  official_status TEXT,
  observed_on TEXT,
  source_id TEXT
);


CREATE UNIQUE INDEX public_people_id ON public_people(id);
CREATE UNIQUE INDEX public_organs_id ON public_organs(chamber, external_id);
CREATE INDEX public_mandates_person ON public_mandates(person_id, starts_on, ends_on);
CREATE UNIQUE INDEX public_ballots_id ON public_ballots(id);
CREATE INDEX public_ballots_date ON public_ballots(chamber, voted_on);
CREATE UNIQUE INDEX public_votes_person_ballot ON public_votes(person_id, ballot_id);
CREATE INDEX public_votes_ballot ON public_votes(ballot_id, position);
CREATE INDEX public_metrics_person ON public_person_metrics(person_id, window_kind);
CREATE INDEX interests_person ON interest_declarations(person_id, published_on);
CREATE INDEX declared_interests_declaration ON declared_interests(declaration_id);
CREATE UNIQUE INDEX campaign_accounts_id ON campaign_accounts(election_id, candidate_id);
CREATE INDEX campaign_accounts_territory ON campaign_accounts(election_id, territory_code);
CREATE INDEX campaign_lines_account ON campaign_account_lines(election_id, candidate_id);
CREATE UNIQUE INDEX local_executives_id ON local_executives(id);
CREATE UNIQUE INDEX cada_opinions_id ON cada_opinions(dossier_id);
CREATE INDEX transparency_alerts_filter ON transparency_alerts(rule, election_id, territory_code);

CREATE TABLE org_groups (
  siren TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  as_of TEXT NOT NULL,
  analysis_path TEXT,
  amount_year INTEGER NOT NULL
);

CREATE TABLE org_group_members (
  group_siren TEXT NOT NULL,
  siren TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  legal_category TEXT NOT NULL,
  active INTEGER NOT NULL,
  parent_siren TEXT,
  source_id TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  identifier_source_id TEXT NOT NULL,
  identifier_ref TEXT NOT NULL,
  parent_kind TEXT NOT NULL,
  PRIMARY KEY (group_siren, siren)
) WITHOUT ROWID;
CREATE INDEX org_group_members_siren ON org_group_members(siren);

CREATE TABLE org_group_amounts (
  group_siren TEXT NOT NULL,
  siren TEXT NOT NULL,
  measure TEXT NOT NULL,
  year INTEGER NOT NULL,
  amount REAL,
  count INTEGER NOT NULL,
  unpriced INTEGER NOT NULL,
  estimated INTEGER NOT NULL,
  PRIMARY KEY (group_siren, siren, measure, year)
) WITHOUT ROWID;

CREATE TABLE commune_constituencies (
  insee TEXT,
  department_code TEXT,
  constituency INTEGER,
  source_id TEXT
);
CREATE UNIQUE INDEX commune_constituencies_id ON commune_constituencies(insee, department_code, constituency);

CREATE TABLE constituency_shapes (
  insee TEXT NOT NULL,
  department_code TEXT NOT NULL,
  constituency INTEGER NOT NULL,
  geometry TEXT NOT NULL,
  source_id TEXT NOT NULL,
  PRIMARY KEY (insee, department_code, constituency)
) WITHOUT ROWID;

CREATE TABLE mandate_constituencies (
  mandate_id TEXT,
  department_code TEXT,
  constituency INTEGER,
  source_id TEXT
);
CREATE UNIQUE INDEX mandate_constituencies_id ON mandate_constituencies(mandate_id);
CREATE INDEX mandate_constituencies_territory ON mandate_constituencies(department_code, constituency);

CREATE TABLE commune_function_labels (
  nomenclature TEXT,
  function_code TEXT,
  label TEXT,
  sort INTEGER
);
CREATE UNIQUE INDEX commune_function_labels_id ON commune_function_labels(nomenclature, function_code);

CREATE TABLE commune_functions (
  insee TEXT,
  year INTEGER,
  nomenclature TEXT,
  section TEXT,
  function_code TEXT,
  amount REAL,
  per_capita REAL
);
CREATE UNIQUE INDEX commune_functions_id ON commune_functions(insee, year, nomenclature, section, function_code);

CREATE TABLE commune_function_strata (
  stratum TEXT,
  year INTEGER,
  nomenclature TEXT,
  section TEXT,
  function_code TEXT,
  median_per_capita REAL,
  communes INTEGER
);
CREATE UNIQUE INDEX commune_function_strata_id ON commune_function_strata(stratum, year, nomenclature, section, function_code);
