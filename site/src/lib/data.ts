import { env } from "cloudflare:workers";
import type { ConstituencyGeometry } from "./constituencies";
import { NBSP } from "./format";
import { pageNumber } from "./democracy";
import { normalizeSearch, searchTopics } from "./topics";
import { kindIcon, type IconName } from "./icons";

export interface Source {
  id: string;
  shortName: string;
  name: string;
  publisher: string;
  pageUrl: string;
  fileUrl: string | null;
  recordUrl: string | null;
  codeUrl: string | null;
  licence: { name: string; url: string };
  frequency: string;
  dataDate: string | null;
  freshness:
    | "à jour"
    | "à surveiller"
    | "en attente d’une nouvelle édition"
    | "référence"
    | "date non précisée";
  downloadExpected: boolean;
  usage: string;
  limits: string[];
  retrievedAt: string | null;
  checkedAt: string | null;
  refreshFailed: boolean;
  publishedAt: string | null;
  coverage: string | null;
  rows: number | null;
  sha256: string | null;
  value: number | null;
}

export interface SourceCitation {
  source: Source;
  recordUrl: string | null;
}

export interface Provenance {
  citations: SourceCitation[];
  method: string;
  calculationUrl: string;
}

export interface Fact {
  value: number;
  period: string;
  provenance: Provenance;
}

export interface YearAmount {
  year: number;
  amount: number;
  count: number;
}

export interface Counterpart {
  siren: string | null;
  name: string;
  amount: number;
  count: number;
}

export interface Contract {
  uid: string;
  buyerSiren: string | null;
  buyerName: string;
  subject: string | null;
  amount: number | null;
  amountFlag: string | null;
  declaredAmount: number | null;
  amountEstimated: boolean;
  amountCounted: boolean;
  share: number | null;
  holders: number;
  holdersLabel: string;
  notifiedOn: string | null;
  sourceUrl: string | null;
}

export type ContractRole = "titulaire" | "acheteur";

export interface ContractFlow {
  role: ContractRole;
  amount: number;
  count: number;
  unpriced: number;
  estimated: number;
  years: YearAmount[];
  counterparts: Counterpart[];
  contracts: Contract[];
  provenance: Provenance;
}

export interface GrantProgramme {
  code: string | null;
  label: string | null;
  amount: number;
  count: number;
}

export interface Grant {
  programmeCode: string | null;
  programmeLabel: string | null;
  amount: number;
  purpose: string | null;
}

export interface Grants {
  year: number;
  amount: number;
  count: number;
  programmes: GrantProgramme[];
  largest: Grant[];
  provenance: Provenance;
}

export interface Organisation {
  siren: string;
  name: string;
  kind: string;
  activity: string | null;
  active: boolean;
  commune: { insee: string; name: string } | null;
  won: ContractFlow | null;
  awarded: ContractFlow | null;
  grants: Grants | null;
  identity: Provenance;
}

export type GroupMeasure = ContractRole | "versement";

const GROUP_MEASURES: GroupMeasure[] = ["titulaire", "acheteur", "versement"];

export interface GroupAmount {
  amount: number | null;
  count: number;
  unpriced: number;
  estimated: number;
}

export interface OrganisationGroup {
  siren: string;
  name: string;
  asOf: string;
  year: number;
  analysisPath: string | null;
  members: {
    siren: string;
    name: string;
    parentSiren: string | null;
    parentKind: "root" | "direct" | "ultimate";
    evidence: SourceCitation;
    reference: string;
    amounts: Record<GroupMeasure, GroupAmount | null>;
  }[];
  totals: Record<GroupMeasure, GroupAmount | null>;
  provenance: Provenance;
  moneyProvenance: Provenance;
}

export async function getOrganisationGroup(siren: string): Promise<OrganisationGroup | null> {
  const groupFilter = "select group_siren from org_group_members where siren = ?1";
  const [groups, members, amounts, sources] = await db().batch<Record<string, unknown>>([
    db().prepare(`select * from org_groups where siren in (${groupFilter})`).bind(siren),
    db()
      .prepare(
        `select m.* from org_group_members m join org_groups g on g.siren = m.group_siren
         where m.group_siren in (${groupFilter})
         order by m.parent_siren is not null,
           exists (select 1 from org_group_amounts a
             where a.group_siren = m.group_siren and a.siren = m.siren
               and a.year = g.amount_year) desc,
           m.name`,
      )
      .bind(siren),
    db()
      .prepare(
        `select a.* from org_group_amounts a join org_groups g on g.siren = a.group_siren
         where a.group_siren in (${groupFilter}) and a.year = g.amount_year`,
      )
      .bind(siren),
    db().prepare(SOURCES_QUERY),
  ]);
  const group = groups?.results[0];
  if (!group) return null;
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  const memberRows = members?.results ?? [];
  const amountRows = (amounts?.results ?? []) as unknown as (GroupAmount & {
    siren: string;
    measure: GroupMeasure;
  })[];
  const totals = Object.fromEntries(
    GROUP_MEASURES.map((measure) => {
      const rows = amountRows.filter((row) => row.measure === measure);
      const known = rows.filter((row) => row.amount !== null);
      return [
        measure,
        rows.length
          ? {
              amount: known.length ? known.reduce((sum, row) => sum + row.amount!, 0) : null,
              count: rows.reduce((sum, row) => sum + row.count, 0),
              unpriced: rows.reduce((sum, row) => sum + row.unpriced, 0),
              estimated: rows.reduce((sum, row) => sum + row.estimated, 0),
            }
          : null,
      ];
    }),
  ) as OrganisationGroup["totals"];
  const evidence = [
    ...new Set(
      memberRows.flatMap((row) => [
        row["source_id"] as string,
        row["identifier_source_id"] as string,
      ]),
    ),
  ];
  return {
    siren: group["siren"] as string,
    name: group["name"] as string,
    asOf: group["as_of"] as string,
    year: group["amount_year"] as number,
    analysisPath: group["analysis_path"] as string | null,
    members: memberRows.map((row) => ({
      siren: row["siren"] as string,
      name: row["name"] as string,
      parentSiren: row["parent_siren"] as string | null,
      parentKind: row["parent_kind"] as "root" | "direct" | "ultimate",
      evidence:
        row["identifier_source_id"] === "gleif-entities"
          ? index.cite("gleif-entities", {
              lei: row["identifier_ref"] as string,
            })
          : index.cite(row["source_id"] as string),
      reference:
        row["identifier_source_id"] !== "gleif-entities" &&
        row["identifier_ref"] !== row["source_ref"]
          ? `${row["source_ref"] as string} ; identité : ${index.get(row["identifier_source_id"] as string).shortName}, ${row["identifier_ref"] as string}`
          : (row["source_ref"] as string),
      amounts: Object.fromEntries(
        GROUP_MEASURES.map((measure) => [
          measure,
          amountRows.find(
            (amount) => amount.siren === row["siren"] && amount.measure === measure,
          ) ?? null,
        ]),
      ) as Record<GroupMeasure, GroupAmount | null>,
    })),
    totals,
    provenance: index.provenance(
      [...evidence.map((id) => index.cite(id)), index.cite("sirene")],
      `Liens expressément publiés, identifiants vérifiés. Aucun rapprochement par nom. Les identités diffusables proviennent de Sirene. Périmètre partiel au ${group["as_of"] as string}. Les liens GLEIF portent sur la consolidation comptable ultime, avec au moins deux organisations de notre base. Le périmètre SNCF issu des comptes annuels est conservé en priorité. Les groupes à mère étrangère ne sont pas couverts ici.`,
      group["analysis_path"]
        ? "pipeline/sql/38_organisation_groups.sql"
        : "pipeline/sql/40a_organisation_gleif_groups.sql",
    ),
    moneyProvenance: index.provenance(
      [index.cite("decp"), index.cite("jaune-associations")],
      `Somme des seules entités listées, par mesure et année civile. Les marchés sont rattachés à leur notification initiale ; le montant est partagé entre cotitulaires. Montants non exploitables exclus, estimations conservées. Les versements restent dans leur année propre. Aucune somme entre marchés remportés, marchés attribués et versements. Le périmètre du ${group["as_of"] as string} est appliqué aux données de ${group["amount_year"] as number}, sans reconstitution des dates d'entrée et de sortie. Les flux entre entités du groupe ne sont pas éliminés. Une absence de ligne ne prouve pas un montant nul.`,
      "pipeline/sql/40a_organisation_group_amounts.sql",
    ),
  };
}

export interface FinanceLine {
  item: string;
  label: string;
  section: string;
  amount: number;
  perCapita: number | null;
  median: number | null;
}

export interface CommuneAccounts {
  year: number;
  population: number | null;
  stratum: { label: string; communes: number } | null;
  lines: FinanceLine[];
}

export interface CommuneLocation {
  outline: string;
  viewBox: string;
  x: number;
  y: number;
}

export interface Commune {
  insee: string;
  name: string;
  siren: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  regionName: string | null;
  location: CommuneLocation | null;
  latestYear: number;
  accounts: CommuneAccounts;
  history: CommuneAccounts[];
  provenance: Provenance;
  buyer: { siren: string; name: string; flow: ContractFlow } | null;
}

export interface Programme {
  code: string;
  name: string;
  spent: number;
  personnel: number;
  voted: number;
  perHousehold: number;
}

export interface Mission {
  name: string;
  spent: number;
  personnel: number;
  perHousehold: number;
  nextVoted: number;
  programmes: Programme[];
}

export interface RevenueLine {
  category: string;
  code: string;
  name: string;
  amount: number;
}

export interface StateRevenue {
  lines: RevenueLine[];
  gross: number;
  transfers: number;
  net: number;
  provenance: Provenance;
}

export interface VotedBudget {
  year: number;
  voted: number;
  provenance: Provenance;
}

export interface SectorYear {
  year: number;
  spending: number;
  revenue: number;
}

export interface PublicSector {
  code: string;
  name: string;
  years: SectorYear[];
}

export interface PublicFinances {
  sectors: PublicSector[];
  provenance: Provenance;
}

export interface SectorShare {
  code: string;
  spending: number;
}

export interface PublicFunction {
  code: string;
  spending: number;
  sectors: SectorShare[];
}

export interface PublicFunctions {
  year: number;
  functions: PublicFunction[];
  sectors: SectorShare[];
  provenance: Provenance;
}

export interface PublicMoney {
  households: number;
  stateBudget: { year: number; spent: number; provenance: Provenance };
  finances: PublicFinances;
  functions: PublicFunctions;
}

export interface PublicAccountLine {
  block: "depenses" | "recettes" | "soldes";
  code: string;
  label: string;
  amount: number;
}

export interface FamilyFunction {
  code: string;
  name: string;
  spending: number;
}

export interface PublicFamily {
  sector: string;
  year: number;
  spending: number;
  revenue: number;
  households: number;
  lines: PublicAccountLine[];
  history: SectorYear[];
  functions: {
    year: number;
    divisions: FamilyFunction[];
    groups: FamilyFunction[];
    provenance: Provenance;
  };
  members: { sector: string; spending: number }[];
  provenance: Provenance;
  summaryProvenance: Provenance;
}

export interface StateBudget {
  year: number;
  spent: number;
  perHousehold: number;
  households: number;
  missions: Mission[];
  revenue: StateRevenue;
  next: VotedBudget;
  publicFinances: PublicFinances;
  provenance: Provenance;
}

export interface SearchResult {
  group: "Thèmes" | "Responsables publics" | "Élus" | "Communes" | "Organisations";
  icon: IconName;
  kind: string;
  name: string;
  detail: string;
  href: string;
}

export interface DownloadFile {
  file: string;
  format: string;
  bytes: number;
  sha256: string;
}

export interface DownloadTable {
  table: string;
  description: string;
  rows: number;
  files: DownloadFile[];
}

export interface Downloads {
  builtAt: string | null;
  tables: DownloadTable[];
}

export interface Manifest {
  builtAt: string | null;
  sources: (Source & { urls: string[] })[];
}

const SQL = {
  contracts: "pipeline/sql/10_contracts.sql",
  identities: "pipeline/sql/30_identities.sql",
  budget: "pipeline/sql/25_budget.sql",
  revenue: "pipeline/sql/26_revenue.sql",
  voted: "pipeline/src/chaque_euro/lfi.py",
  publicFinances: "pipeline/sql/28_public_finances.sql",
  publicFunctions: "pipeline/sql/29_public_functions.sql",
  publicAccounts: "pipeline/sql/28_sector_accounts.sql",
  orgs: "pipeline/sql/40_orgs.sql",
  communes: "pipeline/sql/50_communes.sql",
  departements: "pipeline/sql/60_departements.sql",
  facts: "pipeline/sql/70_facts.sql",
} as const;

const METHOD = {
  titulaire:
    "Somme des montants des marchés notifiés depuis 2019 dont l'organisation est titulaire. Un marché à plusieurs titulaires est réparti à parts égales. Les montants signalés comme aberrants ou suspects par le consolidateur, absents, non positifs ou d’au moins 999 999 999 € ne sont pas comptés.",
  acheteur:
    "Somme des montants des marchés notifiés depuis 2019 par cet acheteur, chaque marché compté une fois. Les montants signalés comme aberrants ou suspects par le consolidateur, absents, non positifs ou d’au moins 999 999 999 € ne sont pas comptés.",
  grants:
    "Somme des crédits versés en 2025 à ce SIREN (tous établissements) dans l'annexe Jaune du projet de loi de finances 2027. Le fichier regroupe subventions, prestations de services et autres versements sans permettre de les distinguer.",
  identity:
    "Nom et catégorie juridique issus de Sirene. Les entrepreneurs individuels et les unités non diffusibles ne sont jamais nommés.",
  commune:
    "Montant de chaque poste divisé par la population totale de la commune. La médiane porte sur les communes de la même strate de population, pour la même année.",
  departement:
    "Somme des dépenses totales des communes du département, divisée par la somme de leurs habitants, pour la dernière année publiée.",
  budget:
    "Crédits de paiement consommés en 2025 sur le budget général, divisés par le nombre de ménages recensés par l'Insee.",
  revenue:
    "Recettes encaissées en 2025 sur le budget général, avant les impôts rendus aux contribuables. Les prélèvements sur recettes, versés aux collectivités et à l'Union européenne, en sont retirés.",
  voted:
    "Crédits de paiement votés pour 2026 (état B de la loi de finances), mission par mission. Les missions sont rapprochées de celles de 2025 par leur nom.",
  publicFinances:
    "Dépenses et recettes de chaque sous-secteur des administrations publiques, en comptabilité nationale. Le total «\u00a0Ensemble\u00a0» retire les flux entre sous-secteurs.",
  publicAccounts:
    "Tableaux Insee 3.203 à 3.214, montants convertis en euros. Les totaux de dépenses et recettes des quatre familles sont contrôlés contre le tableau 3.215 à 0,05 Md€ près. Le solde est la recette moins la dépense. Les transferts fiscaux et impôts non recouvrables corrigent les impôts reçus. Investissement : formation de capital et autres acquisitions nettes d’actifs non financiers. Les subventions et autres transferts comprennent le reste des dépenses, dont les impôts acquittés. Par ménage : dépenses divisées par le nombre de ménages Insee, sans représenter votre contribution personnelle.",
  publicFunctions:
    "Dépenses de l'ensemble des administrations publiques, classées par fonction. L'argent qu'une administration verse à une autre n'est compté qu'une fois, chez celle qui le dépense.",
} as const;

const db = (): D1Database => env.DB;

export function calculationUrl(path: string): string {
  return `${env.PUBLIC_REPO_URL}/blob/${env.CODE_REF}/${path}`;
}

interface SourceRow {
  id: string;
  short_name: string;
  name: string;
  publisher: string;
  page_url: string;
  file_url: string | null;
  record_url: string | null;
  code_url: string | null;
  licence_name: string;
  licence_url: string;
  frequency: string;
  data_date: string | null;
  freshness_retrieval_days: number;
  freshness_data_days: number;
  usage: string;
  limits: string;
  retrieved_at: string | null;
  checked_at: string | null;
  refresh_error: string | null;
  download_expected: number;
  published_at: string | null;
  coverage: string | null;
  rows: number | null;
  sha256: string | null;
  value: number | null;
}

function toSource(row: SourceRow): Source {
  const age = (date: string | null) =>
    date ? (Date.now() - new Date(date).getTime()) / 86400000 : Infinity;
  const freshness: Source["freshness"] = row.refresh_error
    ? "à surveiller"
    : !row.download_expected
      ? "référence"
      : row.freshness_retrieval_days > 0 && age(row.checked_at) > row.freshness_retrieval_days
        ? "à surveiller"
        : !row.data_date
          ? "date non précisée"
          : row.freshness_data_days > 0 && age(row.data_date) > row.freshness_data_days
            ? "en attente d’une nouvelle édition"
            : "à jour";
  return {
    id: row.id,
    shortName: row.short_name,
    name: row.name,
    publisher: row.publisher,
    pageUrl: row.page_url,
    fileUrl: row.file_url,
    recordUrl: row.record_url,
    codeUrl: row.code_url,
    licence: { name: row.licence_name, url: row.licence_url },
    frequency: row.frequency,
    dataDate: row.data_date,
    freshness,
    downloadExpected: Boolean(row.download_expected),
    usage: row.usage,
    limits: JSON.parse(row.limits) as string[],
    retrievedAt: row.retrieved_at,
    checkedAt: row.checked_at,
    refreshFailed: Boolean(row.refresh_error),
    publishedAt: row.published_at,
    coverage: row.coverage,
    rows: row.rows,
    sha256: row.sha256,
    value: row.value,
  };
}

const SOURCES_QUERY = "select * from sources order by rowid";

class SourceIndex {
  private readonly byId: Map<string, Source>;

  constructor(rows: SourceRow[]) {
    this.byId = new Map(rows.map((row) => [row.id, toSource(row)]));
  }

  get(id: string): Source {
    const source = this.byId.get(id);
    if (!source) throw new Error(`Unknown source ${id}`);
    return source;
  }

  cite(id: string, params: Record<string, string | number> = {}): SourceCitation {
    const source = this.get(id);
    const template = source.recordUrl;
    const recordUrl =
      template && Object.keys(params).length > 0
        ? template.replace(/\{(\w+)\}/g, (_, key: string) =>
            encodeURIComponent(String(params[key] ?? "")),
          )
        : null;
    return { source, recordUrl };
  }

  provenance(citations: SourceCitation[], method: string, sqlPath: string): Provenance {
    return { citations, method, calculationUrl: calculationUrl(sqlPath) };
  }
}

export async function getSources(): Promise<Source[]> {
  const { results } = await db().prepare(SOURCES_QUERY).all<SourceRow>();
  return results.map(toSource);
}

interface DownloadRow extends DownloadFile {
  table_name: string;
  description: string;
  rows: number;
}

export async function getDownloads(): Promise<Downloads> {
  const [build, files] = await db().batch<Record<string, unknown>>([
    db().prepare("select value from build where key = 'built_at'"),
    db().prepare("select * from downloads order by rowid"),
  ]);
  const tables = new Map<string, DownloadTable>();
  for (const row of (files?.results ?? []) as unknown as DownloadRow[]) {
    const table = tables.get(row.table_name) ?? {
      table: row.table_name,
      description: row.description,
      rows: row.rows,
      files: [],
    };
    table.files.push({ file: row.file, format: row.format, bytes: row.bytes, sha256: row.sha256 });
    tables.set(row.table_name, table);
  }
  return {
    builtAt: (build?.results[0]?.["value"] as string | undefined) ?? null,
    tables: [...tables.values()],
  };
}

export async function getManifest(): Promise<Manifest> {
  const [build, sources, urls] = await db().batch<Record<string, unknown>>([
    db().prepare("select value from build where key = 'built_at'"),
    db().prepare(SOURCES_QUERY),
    db().prepare("select source_id, url from source_urls order by rowid"),
  ]);
  const urlsBySource = new Map<string, string[]>();
  for (const row of urls?.results ?? []) {
    const id = row["source_id"] as string;
    urlsBySource.set(id, [...(urlsBySource.get(id) ?? []), row["url"] as string]);
  }
  return {
    builtAt: (build?.results[0]?.["value"] as string | undefined) ?? null,
    sources: ((sources?.results ?? []) as unknown as SourceRow[]).map((row) => ({
      ...toSource(row),
      urls: urlsBySource.get(row.id) ?? [],
    })),
  };
}

export interface YearTotal {
  year: number;
  count: number;
  amount: number;
}

export interface StratumMedian {
  stratum: string;
  label: string;
  median: number;
  communes: number;
}

export interface Home {
  facts: Record<string, Fact>;
  contractsByYear: YearTotal[];
  contractsProvenance: Provenance;
  strata: StratumMedian[];
  strataProvenance: Provenance;
}

export interface RankedOrganisation {
  siren: string;
  name: string;
  kind: string;
  amount: number;
  count: number;
}

export interface OrganisationsIndex {
  facts: Record<string, Fact>;
  companies: RankedOrganisation[];
  associations: RankedOrganisation[];
  buyers: RankedOrganisation[];
  contractsProvenance: Provenance;
  grantsProvenance: Provenance;
}

export interface CommuneSummary {
  insee: string;
  name: string;
  departmentCode: string | null;
  population: number | null;
  perCapita: number | null;
  median: number | null;
}

export interface DepartementSummary {
  code: string;
  name: string;
  communes: number;
  population: number;
  perCapita: number;
  path: string;
  labelX: number;
  labelY: number;
  labelSize: number;
}

export interface CommunesIndex {
  year: number;
  count: number;
  largest: CommuneSummary[];
  strata: StratumMedian[];
  provenance: Provenance;
  departements: DepartementSummary[];
  franceViewBox: string;
  mapProvenance: Provenance;
}

export interface DepartementCommune {
  insee: string;
  name: string;
  population: number | null;
  perCapita: number | null;
  median: number | null;
  path: string | null;
  cx: number | null;
  cy: number | null;
}

export interface Departement {
  code: string;
  name: string;
  year: number;
  population: number;
  spending: number;
  perCapita: number;
  viewBox: string;
  communes: DepartementCommune[];
  provenance: Provenance;
}

const keepNumbersTogether = (text: string) => text.replace(/(\d) (\d)/g, `$1${NBSP}$2`);

function strataFrom(result: D1Result<Record<string, unknown>> | undefined): StratumMedian[] {
  return ((result?.results ?? []) as unknown as StratumMedian[]).map((stratum) => ({
    ...stratum,
    label: keepNumbersTogether(stratum.label),
  }));
}

const FACTS_QUERY = "select key, value, period, source_ids from facts";
const STRATA_QUERY = `
  select stratum, label, median_per_capita as median, communes from strata
  where item = 'depenses' and year = (select max(year) from strata)
  order by cast(stratum as integer)`;

function factsFrom(rows: Record<string, unknown>[], index: SourceIndex): Record<string, Fact> {
  return Object.fromEntries(
    rows.map((row) => [
      row["key"] as string,
      {
        value: row["value"] as number,
        period: row["period"] as string,
        provenance: index.provenance(
          (row["source_ids"] as string).split(",").map((id) => index.cite(id)),
          "Agrégat national calculé à partir des fichiers sources.",
          SQL.facts,
        ),
      },
    ]),
  );
}

export async function getHome(): Promise<Home> {
  const [facts, timeline, strata, sources] = await db().batch<Record<string, unknown>>([
    db().prepare(FACTS_QUERY),
    db().prepare("select series, year, value from timeline order by year"),
    db().prepare(STRATA_QUERY),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  const byYear = new Map<number, YearTotal>();
  for (const row of timeline?.results ?? []) {
    const year = row["year"] as number;
    const entry = byYear.get(year) ?? { year, count: 0, amount: 0 };
    if (row["series"] === "contracts_count") entry.count = row["value"] as number;
    else entry.amount = row["value"] as number;
    byYear.set(year, entry);
  }
  return {
    facts: factsFrom(facts?.results ?? [], index),
    contractsByYear: [...byYear.values()],
    contractsProvenance: index.provenance(
      [index.cite("decp")],
      "Nombre de marchés notifiés chaque année et somme de leurs montants, chaque marché compté une fois. Les montants signalés comme aberrants ou suspects par le consolidateur, absents, non positifs ou d’au moins 999 999 999 € ne sont pas comptés.",
      SQL.facts,
    ),
    strata: strataFrom(strata),
    strataProvenance: index.provenance(
      [index.cite("ofgl-communes")],
      "Médiane des dépenses totales par habitant des communes de chaque strate de population.",
      SQL.communes,
    ),
  };
}

export async function getOrganisationsIndex(): Promise<OrganisationsIndex> {
  const ranked = (column: string, count: string, where: string) =>
    db().prepare(
      `select siren, name, kind, ${column} as amount, ${count} as count from orgs
       where ${where} order by ${column} desc limit 10`,
    );
  const [facts, companies, associations, buyers, sources] = await db().batch<
    Record<string, unknown>
  >([
    db().prepare(FACTS_QUERY),
    ranked("won_amount", "won_count", "kind = 'Société commerciale'"),
    ranked("grants_amount", "grants_count", "kind = 'Association'"),
    ranked("awarded_amount", "awarded_count", "awarded_count > 0"),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  const rows = (result: D1Result<Record<string, unknown>> | undefined) =>
    (result?.results ?? []) as unknown as RankedOrganisation[];
  return {
    facts: factsFrom(facts?.results ?? [], index),
    companies: rows(companies),
    associations: rows(associations),
    buyers: rows(buyers),
    contractsProvenance: index.provenance(
      [index.cite("decp"), index.cite("sirene")],
      METHOD.titulaire,
      SQL.orgs,
    ),
    grantsProvenance: index.provenance([index.cite("jaune-associations")], METHOD.grants, SQL.orgs),
  };
}

export async function getCommunesIndex(): Promise<CommunesIndex> {
  const [count, largest, strata, sources, departements, viewBox] = await db().batch<
    Record<string, unknown>
  >([
    db().prepare("select count(*) as count from communes"),
    db().prepare(
      `select c.insee, c.name, c.department_code as departmentCode, c.population, c.year,
         f.per_capita as perCapita, s.median_per_capita as median
       from communes c
       left join commune_finances f on f.insee = c.insee and f.year = c.year and f.item = 'depenses'
       left join strata s on s.stratum = c.stratum and s.year = c.year and s.item = 'depenses'
       order by c.population desc limit 15`,
    ),
    db().prepare(STRATA_QUERY),
    db().prepare(SOURCES_QUERY),
    db().prepare(
      `select code, name, communes, population, per_capita as perCapita, path,
         label_x as labelX, label_y as labelY, label_size as labelSize
       from departements order by code`,
    ),
    db().prepare("select value from build where key = 'france_viewbox'"),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  const largestRows = (largest?.results ?? []) as unknown as (CommuneSummary & { year: number })[];
  return {
    year: largestRows[0]?.year ?? 0,
    count: (count?.results[0]?.["count"] as number | undefined) ?? 0,
    largest: largestRows,
    strata: strataFrom(strata),
    provenance: index.provenance([index.cite("ofgl-communes")], METHOD.commune, SQL.communes),
    departements: (departements?.results ?? []) as unknown as DepartementSummary[],
    franceViewBox: (viewBox?.results[0]?.["value"] as string | undefined) ?? "0 0 0 0",
    mapProvenance: index.provenance(
      [index.cite("ofgl-communes"), index.cite("contours-departements")],
      METHOD.departement,
      SQL.departements,
    ),
  };
}

export async function getDepartement(code: string): Promise<Departement | null> {
  const [departements, communes, sources] = await db().batch<Record<string, unknown>>([
    db().prepare("select * from departements where code = ?1").bind(code),
    db()
      .prepare(
        `select c.insee, c.name, y.population, f.per_capita as perCapita,
           s.median_per_capita as median, g.path, g.cx, g.cy
         from communes c
         join departements d on d.code = c.department_code
         left join commune_years y on y.insee = c.insee and y.year = d.year
         left join commune_finances f on f.insee = c.insee and f.year = d.year and f.item = 'depenses'
         left join strata s on s.stratum = y.stratum and s.year = d.year and s.item = 'depenses'
         left join commune_shapes g on g.insee = c.insee
         where c.department_code = ?1
         order by y.population desc`,
      )
      .bind(code),
    db().prepare(SOURCES_QUERY),
  ]);
  const row = departements?.results[0];
  if (!row) return null;
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  return {
    code: row["code"] as string,
    name: row["name"] as string,
    year: row["year"] as number,
    population: row["population"] as number,
    spending: row["spending"] as number,
    perCapita: row["per_capita"] as number,
    viewBox: row["viewbox"] as string,
    communes: (communes?.results ?? []) as unknown as DepartementCommune[],
    provenance: index.provenance(
      [index.cite("ofgl-communes"), index.cite("contours-communes")],
      METHOD.commune,
      SQL.departements,
    ),
  };
}

interface ContractRow {
  role: ContractRole;
  uid: string;
  buyer_siren: string | null;
  buyer_name: string;
  subject: string | null;
  amount: number | null;
  amount_flag: string | null;
  declared_amount: number | null;
  amount_estimated: number;
  amount_counted: number;
  holders: number;
  holders_label: string;
  notified_on: string | null;
  source_url: string | null;
}

function toContract(row: ContractRow): Contract {
  const counted = Boolean(row.amount_counted);
  return {
    uid: row.uid,
    buyerSiren: row.buyer_siren,
    buyerName: row.buyer_name,
    subject: row.subject,
    amount: row.amount,
    amountFlag: row.amount_flag,
    declaredAmount: row.declared_amount,
    amountEstimated: Boolean(row.amount_estimated),
    amountCounted: counted,
    share: counted && row.amount !== null ? row.amount / row.holders : null,
    holders: row.holders,
    holdersLabel: row.holders_label,
    notifiedOn: row.notified_on,
    sourceUrl: row.source_url,
  };
}

const CONTRACTS_QUERY = `
  select oc.role, c.uid, c.buyer_siren, coalesce(o.name, 'Acheteur non identifié') as buyer_name,
    c.subject, c.amount, c.amount_flag, c.declared_amount, c.amount_estimated, c.amount_counted, c.holders, c.holders_label, c.notified_on,
    f.url as source_url
  from org_contracts oc
  join contracts c on c.id = oc.contract_id
  left join orgs o on o.siren = c.buyer_siren
  left join source_files f on f.id = c.source_file_id
  where oc.siren = ?1`;

function sortContracts(contracts: Contract[]): Contract[] {
  return contracts.sort(
    (a, b) =>
      Number(b.share !== null) - Number(a.share !== null) ||
      (b.amount ?? 0) - (a.amount ?? 0) ||
      (b.notifiedOn ?? "").localeCompare(a.notifiedOn ?? ""),
  );
}

interface OrgRow {
  siren: string;
  name: string;
  kind: string;
  activity: string | null;
  active: number;
  won_amount: number;
  won_count: number;
  won_unpriced: number;
  won_estimated: number;
  awarded_amount: number;
  awarded_count: number;
  awarded_unpriced: number;
  awarded_estimated: number;
  grants_amount: number;
  grants_count: number;
}

function contractFlow(
  role: ContractRole,
  org: OrgRow,
  years: YearAmount[],
  counterparts: Counterpart[],
  contracts: Contract[],
  index: SourceIndex,
): ContractFlow | null {
  const count = role === "titulaire" ? org.won_count : org.awarded_count;
  if (count === 0) return null;
  return {
    role,
    amount: role === "titulaire" ? org.won_amount : org.awarded_amount,
    count,
    unpriced: role === "titulaire" ? org.won_unpriced : org.awarded_unpriced,
    estimated: role === "titulaire" ? org.won_estimated : org.awarded_estimated,
    years,
    counterparts,
    contracts: sortContracts(contracts),
    provenance: index.provenance(
      [index.cite("decp"), index.cite("sirene", { siren: org.siren })],
      METHOD[role],
      SQL.orgs,
    ),
  };
}

export async function getOrganisation(siren: string): Promise<Organisation | null> {
  const statements = [
    db()
      .prepare(
        `select * from orgs where siren = ?1
         union all
         select siren, name, kind, legal_category, null, active,
           0, 0, 0, 0, 0, 0, 0, 0, 0, 0
         from org_group_members where siren = ?1
           and not exists (select 1 from orgs where siren = ?1)
         limit 1`,
      )
      .bind(siren),
    db()
      .prepare("select role, year, amount, count from org_years where siren = ?1 order by year")
      .bind(siren),
    db()
      .prepare(
        `select role, counterpart_siren as siren, counterpart_name as name, amount, count
         from org_counterparts where siren = ?1 order by role, rank`,
      )
      .bind(siren),
    db().prepare(CONTRACTS_QUERY).bind(siren),
    db()
      .prepare(
        `select programme_code as code, programme_label as label, sum(amount) as amount,
           count(*) as count, max(year) as year
         from grants where siren = ?1 group by programme_code order by amount desc`,
      )
      .bind(siren),
    db()
      .prepare(
        `select programme_code, programme_label, amount, purpose
         from grants where siren = ?1 order by amount desc limit 10`,
      )
      .bind(siren),
    db().prepare("select insee, name from communes where siren = ?1").bind(siren),
    db().prepare(SOURCES_QUERY),
  ];
  const [orgs, years, counterparts, contracts, programmes, largest, communes, sources] =
    await db().batch<Record<string, unknown>>(statements);
  const org = orgs?.results[0] as unknown as OrgRow | undefined;
  if (!org) return null;

  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  const byRole = <T>(rows: Record<string, unknown>[], role: ContractRole): T[] =>
    rows.filter((row) => row["role"] === role) as unknown as T[];
  const yearRows = years?.results ?? [];
  const counterpartRows = counterparts?.results ?? [];
  const contractRows = ((contracts?.results ?? []) as unknown as ContractRow[]).map((row) => ({
    role: row.role,
    contract: toContract(row),
  }));
  const contractsFor = (role: ContractRole): Contract[] =>
    contractRows.filter((row) => row.role === role).map((row) => row.contract);
  const flow = (role: ContractRole): ContractFlow | null =>
    contractFlow(
      role,
      org,
      byRole<YearAmount>(yearRows, role),
      byRole<Counterpart>(counterpartRows, role),
      contractsFor(role),
      index,
    );

  const programmeRows = (programmes?.results ?? []) as unknown as (GrantProgramme & {
    year: number;
  })[];
  const grants: Grants | null =
    org.grants_count > 0
      ? {
          year: Math.max(...programmeRows.map((row) => row.year)),
          amount: org.grants_amount,
          count: org.grants_count,
          programmes: programmeRows,
          largest: ((largest?.results ?? []) as Record<string, unknown>[]).map((row) => ({
            programmeCode: row["programme_code"] as string | null,
            programmeLabel: row["programme_label"] as string | null,
            amount: row["amount"] as number,
            purpose: row["purpose"] as string | null,
          })),
          provenance: index.provenance(
            [index.cite("jaune-associations", { siren: org.siren })],
            METHOD.grants,
            SQL.orgs,
          ),
        }
      : null;

  const commune = communes?.results[0] as { insee: string; name: string } | undefined;
  return {
    siren: org.siren,
    name: org.name,
    kind: org.kind,
    activity: org.activity,
    active: org.active === 1,
    commune: commune ?? null,
    won: flow("titulaire"),
    awarded: flow("acheteur"),
    grants,
    identity: index.provenance(
      [index.cite("sirene", { siren: org.siren })],
      METHOD.identity,
      SQL.identities,
    ),
  };
}

interface CommuneRow {
  insee: string;
  name: string;
  department_code: string | null;
  department_name: string | null;
  region_name: string | null;
  siren: string | null;
  year: number;
}

interface FinanceRow {
  item: string;
  label: string;
  section: string;
  year: number;
  population: number | null;
  amount: number;
  per_capita: number | null;
  median: number | null;
  stratum_label: string | null;
  stratum_communes: number | null;
}

function communeAccounts(year: number, rows: FinanceRow[]): CommuneAccounts {
  const stratum = rows.find((line) => line.stratum_label !== null);
  return {
    year,
    population: rows[0]?.population ?? null,
    stratum: stratum?.stratum_label
      ? {
          label: keepNumbersTogether(stratum.stratum_label),
          communes: stratum.stratum_communes ?? 0,
        }
      : null,
    lines: rows.map((line) => ({
      item: line.item,
      label: line.label,
      section: line.section,
      amount: line.amount,
      perCapita: line.per_capita,
      median: line.median,
    })),
  };
}

export async function getCommune(insee: string, year?: number): Promise<Commune | null> {
  const row = await db()
    .prepare("select * from communes where insee = ?1")
    .bind(insee)
    .first<CommuneRow>();
  if (!row) return null;

  const [finances, orgs, years, counterparts, contracts, sources, location] = await db().batch<
    Record<string, unknown>
  >([
    db()
      .prepare(
        `select f.item, i.label, i.section, f.year, y.population, f.amount, f.per_capita,
           s.median_per_capita as median, s.label as stratum_label, s.communes as stratum_communes
         from commune_finances f
         join finance_items i using (item)
         join commune_years y on y.insee = f.insee and y.year = f.year
         left join strata s on s.stratum = y.stratum and s.year = f.year and s.item = f.item
         where f.insee = ?1
         order by f.year, i.sort`,
      )
      .bind(insee),
    db().prepare("select * from orgs where siren = ?1").bind(row.siren),
    db()
      .prepare(
        "select role, year, amount, count from org_years where siren = ?1 and role = 'acheteur' order by year",
      )
      .bind(row.siren),
    db()
      .prepare(
        `select role, counterpart_siren as siren, counterpart_name as name, amount, count
         from org_counterparts where siren = ?1 and role = 'acheteur' order by rank`,
      )
      .bind(row.siren),
    db().prepare(`${CONTRACTS_QUERY} and oc.role = 'acheteur'`).bind(row.siren),
    db().prepare(SOURCES_QUERY),
    db()
      .prepare(
        `select d.outline, d.viewbox as viewBox, g.cx as x, g.cy as y
         from commune_shapes g join departements d on d.code = ?2
         where g.insee = ?1`,
      )
      .bind(insee, row.department_code),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  const financeRows = (finances?.results ?? []) as unknown as FinanceRow[];
  const history = [...new Set(financeRows.map((line) => line.year))].map((entry) =>
    communeAccounts(
      entry,
      financeRows.filter((line) => line.year === entry),
    ),
  );
  const accounts = history.find((entry) => entry.year === year) ?? history.at(-1);
  if (!accounts) return null;
  const org = orgs?.results[0] as unknown as OrgRow | undefined;
  const flow = org
    ? contractFlow(
        "acheteur",
        org,
        (years?.results ?? []) as unknown as YearAmount[],
        (counterparts?.results ?? []) as unknown as Counterpart[],
        ((contracts?.results ?? []) as unknown as ContractRow[]).map(toContract),
        index,
      )
    : null;

  return {
    insee: row.insee,
    name: row.name,
    siren: row.siren,
    departmentCode: row.department_code,
    departmentName: row.department_name,
    regionName: row.region_name,
    location: (location?.results[0] as CommuneLocation | undefined) ?? null,
    latestYear: row.year,
    accounts,
    history,
    provenance: index.provenance(
      [index.cite("ofgl-communes", { insee: row.insee, year: accounts.year })],
      METHOD.commune,
      SQL.communes,
    ),
    buyer: org && flow ? { siren: org.siren, name: org.name, flow } : null,
  };
}

interface BudgetRow {
  programme_code: string;
  mission: string;
  programme: string;
  spent: number;
  personnel: number;
  voted: number;
}

interface PublicFinanceRow {
  sector: string;
  name: string;
  year: number;
  spending: number;
  revenue: number;
}

interface PublicFunctionRow {
  sector: string;
  function: string;
  year: number;
  spending: number;
}

interface RevenueRow {
  category: string;
  section_code: string;
  section: string;
  amount: number;
}

const BUDGET_YEAR = 2025;

function toPublicFinances(results: unknown[], index: SourceIndex): PublicFinances {
  const sectors = new Map<string, PublicSector>();
  for (const row of results as PublicFinanceRow[]) {
    const sector = sectors.get(row.sector) ?? { code: row.sector, name: row.name, years: [] };
    sector.years.push({ year: row.year, spending: row.spending, revenue: row.revenue });
    sectors.set(row.sector, sector);
  }
  return {
    sectors: [...sectors.values()],
    provenance: index.provenance(
      [index.cite("insee-apu")],
      METHOD.publicFinances,
      SQL.publicFinances,
    ),
  };
}

export async function getPublicMoney(): Promise<PublicMoney> {
  const [finances, functions, budget, sources] = await db().batch<Record<string, unknown>>([
    db().prepare("select * from public_finances order by sector, year"),
    db().prepare(
      "select sector, function, year, spending from public_functions where length(function) = 4 and year = (select max(year) from public_functions) order by spending desc",
    ),
    db().prepare("select sum(spent) as spent from budget"),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  const rows = (functions?.results ?? []) as unknown as PublicFunctionRow[];
  const byFunction = new Map<string, PublicFunction>();
  for (const row of rows.filter((row) => row.sector === "S13")) {
    byFunction.set(row.function, { code: row.function, spending: row.spending, sectors: [] });
  }
  const bySector = new Map<string, number>();
  for (const row of rows.filter((row) => row.sector !== "S13")) {
    byFunction.get(row.function)?.sectors.push({ code: row.sector, spending: row.spending });
    bySector.set(row.sector, (bySector.get(row.sector) ?? 0) + row.spending);
  }
  const spent = Number((budget?.results?.[0] as { spent?: number } | undefined)?.spent ?? 0);
  return {
    households: index.get("insee-menages").value ?? 0,
    stateBudget: {
      year: BUDGET_YEAR,
      spent,
      provenance: index.provenance([index.cite("plrg-2025")], METHOD.budget, SQL.budget),
    },
    finances: toPublicFinances(finances?.results ?? [], index),
    functions: {
      year: rows[0]?.year ?? 0,
      functions: [...byFunction.values()],
      sectors: [...bySector].map(([code, spending]) => ({ code, spending })),
      provenance: index.provenance(
        [index.cite("insee-apu-fonctions")],
        METHOD.publicFunctions,
        SQL.publicFunctions,
      ),
    },
  };
}

export async function getStateBudget(): Promise<StateBudget> {
  const [budget, revenue, voted, sectors, sources] = await db().batch<Record<string, unknown>>([
    db().prepare("select * from budget order by spent desc"),
    db().prepare("select * from revenue order by section_code"),
    db().prepare("select mission, voted from budget_voted"),
    db().prepare("select * from public_finances order by sector, year"),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  const households = index.get("insee-menages").value ?? 0;
  const votedRows = (voted?.results ?? []) as unknown as { mission: string; voted: number }[];
  const votedByMission = new Map(votedRows.map((row) => [row.mission, row.voted]));
  const missions = new Map<string, Mission>();
  for (const row of (budget?.results ?? []) as unknown as BudgetRow[]) {
    const mission = missions.get(row.mission) ?? {
      name: row.mission,
      spent: 0,
      personnel: 0,
      perHousehold: 0,
      nextVoted: votedByMission.get(row.mission) ?? 0,
      programmes: [],
    };
    mission.spent += row.spent;
    mission.personnel += row.personnel;
    mission.perHousehold = mission.spent / households;
    mission.programmes.push({
      code: row.programme_code,
      name: row.programme,
      spent: row.spent,
      personnel: row.personnel,
      voted: row.voted,
      perHousehold: row.spent / households,
    });
    missions.set(row.mission, mission);
  }
  const ordered = [...missions.values()].sort((a, b) => b.spent - a.spent);
  const spent = ordered.reduce((total, mission) => total + mission.spent, 0);
  const lines = ((revenue?.results ?? []) as unknown as RevenueRow[]).map((row) => ({
    category: row.category,
    code: row.section_code,
    name: row.section,
    amount: row.amount,
  }));
  const gross = lines.reduce((total, line) => total + Math.max(line.amount, 0), 0);
  const transfers = -lines.reduce((total, line) => total + Math.min(line.amount, 0), 0);
  return {
    year: BUDGET_YEAR,
    spent,
    perHousehold: spent / households,
    households,
    missions: ordered,
    next: {
      year: 2026,
      voted: votedRows.reduce((total, row) => total + row.voted, 0),
      provenance: index.provenance(
        [index.cite("lfi-2026"), index.cite("lfi-2026-jorf")],
        METHOD.voted,
        SQL.voted,
      ),
    },
    publicFinances: toPublicFinances(sectors?.results ?? [], index),
    revenue: {
      lines,
      gross,
      transfers,
      net: gross - transfers,
      provenance: index.provenance([index.cite("plrg-2025-recettes")], METHOD.revenue, SQL.revenue),
    },
    provenance: index.provenance(
      [index.cite("plrg-2025"), index.cite("insee-menages")],
      METHOD.budget,
      SQL.budget,
    ),
  };
}

function ftsQuery(query: string): string | null {
  const tokens = normalizeSearch(query).split(" ").filter(Boolean);
  if (!tokens.length) return null;
  return tokens
    .slice(0, 6)
    .map((token) => `"${token}"*`)
    .join(" ");
}

export async function search(query: string): Promise<SearchResult[]> {
  const match = ftsQuery(query);
  if (!match) return [];
  const { results } = await db()
    .prepare(
      "select name, kind, ref, detail, weight from search where search match ?1 order by kind = 'Responsable public' desc, rank limit 80",
    )
    .bind(match)
    .all<{ name: string; kind: string; ref: string; detail: string; weight: number }>();
  const normalized = normalizeSearch(query);
  const entities: SearchResult[] = results
    .sort(
      (a, b) =>
        Number(normalizeSearch(b.name) === normalized) -
          Number(normalizeSearch(a.name) === normalized) ||
        Number(b.kind === "Responsable public") - Number(a.kind === "Responsable public") ||
        b.weight - a.weight,
    )
    .slice(0, 20)
    .map((row) => ({
      group:
        row.kind === "Commune"
          ? "Communes"
          : row.kind === "Responsable public"
            ? "Responsables publics"
            : row.kind === "Élu"
              ? "Élus"
              : "Organisations",
      icon:
        row.kind === "Responsable public"
          ? "state"
          : row.kind === "Élu"
            ? "elected"
            : kindIcon(row.kind),
      kind: row.kind,
      name: row.name,
      detail: row.detail,
      href:
        row.kind === "Commune"
          ? `/commune/${row.ref}`
          : row.kind === "Responsable public"
            ? `/administrations/${row.ref}`
            : row.kind === "Élu"
              ? `/elus/${row.ref}`
              : `/organisation/${row.ref}`,
    }));
  const topics: SearchResult[] = searchTopics(query).map((topic) => ({
    group: "Thèmes",
    kind: "Thème",
    name: topic.title,
    href: topic.href,
    icon: topic.icon,
    detail: "",
  }));
  const order = ["Thèmes", "Responsables publics", "Élus", "Communes", "Organisations"];
  return [...topics, ...entities].sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
}

export async function getPublicFamily(sector: string): Promise<PublicFamily> {
  const [accounts, functions, members, sources] = await db().batch<Record<string, unknown>>([
    db()
      .prepare(
        "select block, code, label, year, amount from public_accounts where sector = ? order by year",
      )
      .bind(sector),
    db()
      .prepare(
        "select function as code, name, year, spending from public_functions where sector = ? and year = (select max(year) from public_functions) order by spending desc",
      )
      .bind(sector),
    db()
      .prepare(
        "select sector, amount as spending from public_accounts where block = 'depenses' and code = 'TOTAL' and sector like ? and sector <> ? and year = (select max(year) from public_accounts where sector = ?) order by amount desc",
      )
      .bind(`${sector}%`, sector, sector),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  const rows = (accounts?.results ?? []) as unknown as (PublicAccountLine & { year: number })[];
  const year = rows.at(-1)?.year ?? 0;
  const lines = rows.filter((row) => row.year === year);
  const history = rows
    .filter((row) => row.block === "depenses" && row.code === "TOTAL")
    .map((row) => ({
      year: row.year,
      spending: row.amount,
      revenue:
        rows.find(
          (other) =>
            other.year === row.year && other.block === "recettes" && other.code === "TOTAL",
        )?.amount ?? 0,
    }));
  const totals = history.at(-1);
  const purposes = (functions?.results ?? []) as unknown as (FamilyFunction & { year: number })[];
  return {
    sector,
    year,
    spending: totals?.spending ?? 0,
    revenue: totals?.revenue ?? 0,
    households: index.get("insee-menages").value ?? 0,
    lines,
    history,
    functions: {
      year: purposes[0]?.year ?? 0,
      divisions: purposes.filter((row) => row.code.length === 4),
      groups: purposes.filter((row) => row.code.length === 6),
      provenance: index.provenance(
        [index.cite("insee-apu-fonctions")],
        METHOD.publicFunctions,
        SQL.publicFunctions,
      ),
    },
    members: (members?.results ?? []) as unknown as PublicFamily["members"],
    provenance: index.provenance(
      [index.cite("insee-apu-comptes")],
      METHOD.publicAccounts,
      SQL.publicAccounts,
    ),
    summaryProvenance: index.provenance(
      [
        index.cite("insee-apu-comptes"),
        index.cite("insee-menages"),
        index.cite("insee-apu-definition"),
      ],
      METHOD.publicAccounts +
        " Périmètre et exemples repris des définitions des sous-secteurs de l’Insee.",
      SQL.publicAccounts,
    ),
  };
}

export interface AnalysisPeriod {
  label: string;
  start: number;
  end: number;
}

export interface DeficitYear {
  year: number;
  apu_balance: number;
  apu_ratio: number;
  state_balance: number | null;
  state_ratio: number | null;
  apu_debt: number | null;
  apu_debt_ratio: number | null;
  state_debt: number | null;
  state_debt_ratio: number | null;
  budget_balance: number | null;
  budget_ratio: number | null;
}

export async function getDeficitAnalysis() {
  const [series, periods, events, sources] = await db().batch<Record<string, unknown>>([
    db().prepare("select * from deficit_series order by year"),
    db().prepare(
      'select label, start_year as start, end_year as "end" from analysis_periods order by start_year',
    ),
    db().prepare(
      'select label, start_year as start, end_year as "end" from analysis_events order by start_year',
    ),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  return {
    years: (series?.results ?? []) as unknown as DeficitYear[],
    periods: (periods?.results ?? []) as unknown as AnalysisPeriod[],
    events: (events?.results ?? []) as unknown as AnalysisPeriod[],
    provenance: index.provenance(
      [index.cite("insee-deficit"), index.cite("insee-debt"), index.cite("state-balance")],
      "Soldes en comptabilité nationale : Insee, 1949-2025 pour les APU, 1959-2025 pour l’État. Dette de Maastricht à fin décembre depuis 1978. Solde budgétaire hors FMI depuis 2009, ratio calculé avec le PIB implicite du tableau 3.215. Euros courants. 2025 provisoire. Les soldes sont signés : un chiffre négatif indique un déficit. En 2024, le tableau 3.215 diffère de la série dédiée de 119,1 M€ pour les APU ; cet écart vérifié est conservé et contrôlé. La dette de chaque sous-secteur est sa contribution à la dette publique consolidée.",
      "pipeline/sql/31_deficit_series.sql",
    ),
    contextProvenance: index.provenance(
      [index.cite("presidents"), index.cite("budget-calendar"), index.cite("economic-events")],
      "Bandes de présidence en repères annuels, sans attribution des résultats d’une année à une personne. Les années d’alternance ne sont pas des années pleines. Les intérims et cohabitations ne sont pas représentés. Les événements sont des repères chronologiques, sans estimation de leur effet causal.",
      "pipeline/sql/36_analysis_context.sql",
    ),
  };
}

export interface EuropeYear {
  year: number;
  expenditure: number;
  contribution: number;
  ngeu: number;
  customs: number | null;
  population: number;
  balance: number;
  per_capita: number;
}

export async function getEuropeAnalysis() {
  const [flows, headings, psr, sources] = await db().batch<Record<string, unknown>>([
    db().prepare("select * from eu_flows order by year"),
    db().prepare(
      "select * from eu_headings where year = (select max(year) from eu_headings) order by amount desc",
    ),
    db().prepare("select amount from revenue where section_code = '32'"),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  return {
    years: (flows?.results ?? []) as unknown as EuropeYear[],
    headings: (headings?.results ?? []) as unknown as {
      year: number;
      code: string;
      label: string;
      amount: number;
    }[],
    psr: -Number(psr?.results[0]?.["amount"] ?? 0),
    provenance: index.provenance(
      [index.cite("eu-budget"), index.cite("france-population")],
      "Classeur Commission, colonne FR, en millions d’euros convertis en euros. Contribution = total des ressources propres, ajustements inclus depuis 2021, droits de douane compris. Dépenses allouées à la France hors NGEU, administration incluse. Solde comptable = dépenses moins contribution : ce n’est pas le solde opérationnel corrigé de la Commission. Par habitant : population Insee France au 1er janvier de la même année, publiée en milliers. Rubriques et total rapprochés chaque année de 2021 à 2025. Les cadres budgétaires et ressources propres changent au cours de la série.",
      "pipeline/sql/32_europe.sql",
    ),
    stateProvenance: index.provenance(
      [index.cite("plrg-2025-recettes")],
      METHOD.revenue,
      SQL.revenue,
    ),
  };
}

export interface AnalysisContext {
  metric: string;
  year: number;
  amount: number;
}

export async function getParisAnalysis() {
  const [comparison, context, sources] = await db().batch<Record<string, unknown>>([
    db().prepare("select * from paris_comparison order by per_capita desc"),
    db().prepare("select * from paris_context order by metric"),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  return {
    comparison: (comparison?.results ?? []) as unknown as {
      city: string;
      year: number;
      spending: number;
      population: number;
      per_capita: number;
    }[],
    context: (context?.results ?? []) as unknown as AnalysisContext[],
    provenance: index.provenance(
      [index.cite("crc-paris")],
      "Rapport CRC 2025, graphique 5 et annexe 5 : fonctionnement 2023, budgets territoriaux rapprochés par allocation à la population des villes. Il ne s’agit pas d’une comparaison de qualité de service. Péréquation 2024 corrigée par la CRC (713 M€), FNGIR distinct. Population présente : estimation Apur 2023 citée par la CRC, non comparable à une population légale. Contributions aux services : tableau 25, 2024. Chiffres extraits du PDF avec contrôle des ratios publiés à 1 € près.",
      "pipeline/sql/33_paris.sql",
    ),
  };
}

export interface RailTransfer {
  year: number;
  operating: number;
  investment: number;
  total: number;
}

export interface RailRevenue {
  year: number;
  service: string;
  commercial: number;
  public: number;
  total: number;
}

export async function getRailAnalysis() {
  const [transfers, revenue, context, network, sources] = await db().batch<Record<string, unknown>>(
    [
      db().prepare("select * from rail_transfers order by year"),
      db().prepare("select * from rail_revenue order by year, service"),
      db().prepare("select * from rail_context order by year"),
      db().prepare("select * from rail_network order by year"),
      db().prepare(SOURCES_QUERY),
    ],
  );
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  return {
    network: (network?.results ?? []) as unknown as {
      year: number;
      eu: number;
      state: number;
      local_other: number;
      total: number;
    }[],
    transfers: (transfers?.results ?? []) as unknown as RailTransfer[],
    revenue: (revenue?.results ?? []) as unknown as RailRevenue[],
    context: (context?.results ?? []) as unknown as AnalysisContext[],
    transferProvenance: index.provenance(
      [index.cite("sdes-rail")],
      "SDES, tableaux A5.2-a (subventions d’investissement à SNCF Réseau) et A5.1-b : transferts publics vers SNCF Voyageurs, hors retraites, millions HT convertis en euros courants. Exploitation inclut contributions et subventions de fonctionnement, ainsi que SAAD et plan Fret lorsqu’ils existent dans la série historique. Investissement et exploitation rapprochés du total à 2 M€ près, compte tenu des arrondis. Le périmètre de l’entreprise évolue en 2015 et 2020. Ce total n’est pas le coût public complet du rail.",
      "pipeline/sql/34_rail.sql",
    ),
    revenueProvenance: index.provenance(
      [index.cite("art-rail")],
      "ART, figure 8.1, revenus des services sur la partie RFN des trajets, euros constants 2024. Pour chaque service, recettes commerciales et concours publics se réconcilient avec les revenus. La part commerciale ne mesure pas la couverture de tous les coûts du système ferroviaire.",
      "pipeline/sql/34_rail.sql",
    ),
    contextProvenance: index.provenance(
      [index.cite("state-balance"), index.cite("rail-dividend"), index.cite("rail-debt")],
      "Reprise de dette : ligne SNCF Réseau du tableau Insee 3.107, 2020 et 2022. Fonds de concours SNCF : tableau des financeurs du programme 203, CP exécutés en 2025, en M€. Ces flux ne s’ajoutent pas aux transferts SDES et ne constituent pas deux subventions indépendantes.",
      "pipeline/sql/34_rail.sql",
    ),
  };
}

export async function getStudentAnalysis() {
  const [scholarships, budget, cost, sources] = await db().batch<Record<string, unknown>>([
    db().prepare("select * from student_scholarships order by year"),
    db().prepare("select * from student_budget order by year, programme"),
    db().prepare("select * from student_cost order by metric"),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  return {
    scholarships: (scholarships?.results ?? []) as unknown as {
      year: number;
      recipients: number;
      share: number;
    }[],
    budget: (budget?.results ?? []) as unknown as {
      year: number;
      stage: "executed" | "voted" | "proposed";
      programme: string;
      amount: number;
    }[],
    cost: (cost?.results ?? []) as unknown as AnalysisContext[],
    budgetProvenance: index.provenance(
      [
        index.cite("plrg-2025"),
        index.cite("lfi-2026"),
        index.cite("lfi-2026-jorf"),
        index.cite("plf-2027"),
      ],
      "Programmes 150 et 231 : crédits de paiement exécutés 2025, LFI 2026 promulguée et PLF 2027 déposé. Les deux dernières colonnes sont des autorisations ou propositions, pas une exécution. Périmètres et transferts entre programmes peuvent changer. Les crédits 2026 et 2027 sont extraits de l’état B des textes.",
      "pipeline/sql/35_students.sql",
    ),
    scholarshipProvenance: index.provenance(
      [index.cite("sies-grants")],
      "MESR-SIES, graphique 1 et annexe 1 : rentrée de chaque année, formations ouvrant droit à bourse MESR, France hors Polynésie française et Nouvelle-Calédonie. Les effectifs des huit échelons se réconcilient avec le total 2025-2026. La part concerne les formations éligibles, pas tous les étudiants. Extraction OLAFE au 15 mars 2026.",
      "pipeline/sql/35_students.sql",
    ),
    costProvenance: index.provenance(
      [index.cite("student-cost")],
      "DEPP, note d’information 25.52, compte de l’éducation 2024 provisoire. Dépense par étudiant, tous financeurs, apprentissage inclus. Ce périmètre est plus large que les programmes 150 et 231 et ne correspond pas à un versement individuel.",
      "pipeline/sql/35_students.sql",
    ),
    responseProvenance: index.provenance(
      [
        index.cite("student-response"),
        index.cite("student-mobilisation"),
        index.cite("student-fees-demand"),
        index.cite("student-fees-response"),
      ],
      "Annonce ministérielle du 26 octobre 2026 : distingue le repas généralisé le 4 mai 2026 des engagements pour la rentrée 2027 et les années suivantes. Les objectifs de logement sont distincts des places livrées.",
      "pipeline/sql/36_analysis_context.sql",
    ),
  };
}

export interface NationalAmount {
  year: number;
  label: string;
  amount: number;
}

export interface MonthlyExecution {
  year: number;
  month: number;
  spending: number;
  revenue: number;
  balance: number;
}

export interface StateAssets {
  year: number;
  assets: number;
  liabilities: number;
  net_position: number;
}

export interface EuropeanFinances {
  geo: string;
  year: number;
  spending: number;
  revenue: number;
  balance: number;
  debt: number;
  status: string | null;
}

export async function getStateExecution() {
  const [monthly, titles, ministries, assets, green, sources] = await db().batch([
    db().prepare("select * from state_monthly order by year, month"),
    db().prepare("select year, label, amount from state_titles order by amount desc"),
    db().prepare(
      "select year, ministry as label, amount from state_ministries order by amount desc",
    ),
    db().prepare("select * from state_assets order by year desc limit 1"),
    db().prepare("select year, rating as label, amount from green_budget order by amount desc"),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  const provenance = (ids: string[], method: string, sql: string) =>
    index.provenance(
      ids.map((id) => index.cite(id)),
      method,
      `pipeline/sql/${sql}.sql`,
    );
  return {
    monthly: {
      rows: (monthly?.results ?? []) as unknown as MonthlyExecution[],
      provenance: provenance(
        ["state-monthly"],
        "Cumuls depuis janvier en euros. Dépenses et recettes nettes du budget général ; le solde inclut aussi les prélèvements sur recettes, fonds de concours, comptes spéciaux et budgets annexes. Données provisoires en cours d’année.",
        "25a_state_monthly",
      ),
    },
    titles: {
      rows: (titles?.results ?? []) as unknown as NationalAmount[],
      provenance: provenance(
        ["state-titles", "plrg-2025"],
        "Crédits de paiement exécutés 2025, budget général, remboursements et dégrèvements inclus. Rapprochement par programme avec le PLRG.",
        "25b_state_titles",
      ),
    },
    ministries: {
      rows: (ministries?.results ?? []) as unknown as NationalAmount[],
      provenance: provenance(
        ["state-titles", "state-ministries"],
        "Dépenses exécutées 2025 rattachées par programme au ministère de la nomenclature DGFiP 2025. Budget général, remboursements et dégrèvements inclus.",
        "25b_state_titles",
      ),
    },
    assets: {
      row: (assets?.results[0] ?? null) as unknown as StateAssets | null,
      provenance: provenance(
        ["state-assets"],
        "Balances 2025 agrégées par catégorie comptable en euros. Situation nette = actif − passif, contrôlée avec les comptes de situation nette et le résultat de l’exercice. Les engagements hors bilan sont exclus.",
        "25c_state_assets",
      ),
    },
    green: {
      rows: (green?.results ?? []) as unknown as NationalAmount[],
      provenance: provenance(
        ["green-budget"],
        "Somme des crédits budgétaires proposés au PLF 2026 par cotation globale. Les montants ventilés sont déjà pondérés dans le fichier ; aucune pondération supplémentaire. Taxes affectées et dépenses fiscales exclues.",
        "27a_green_budget",
      ),
    },
  };
}

export async function getPublicIndicators() {
  const [levies, europe, functions, debt, sources] = await db().batch([
    db().prepare(
      "select * from compulsory_levies where year=(select max(year) from compulsory_levies) order by amount desc",
    ),
    db().prepare(
      "select * from european_finances where year=(select max(year) from european_finances group by year having count(*)=6 order by year desc limit 1) order by spending desc",
    ),
    db().prepare("select * from european_functions order by year, function, geo"),
    db().prepare("select * from quarterly_debt order by period desc limit 1"),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  return {
    levies: {
      rows: (levies?.results ?? []) as unknown as (NationalAmount & {
        block: string;
        code: string;
      })[],
      provenance: index.provenance(
        [index.cite("insee-levies")],
        "Tableau 3.216 : bénéficiaires sans double compte. Tableau 3.217 : sélection des principaux impôts et cotisations effectives, sans additionner les sous-totaux. Les deux totaux de prélèvements obligatoires sont rapprochés.",
        "pipeline/sql/28_levies.sql",
      ),
    },
    europe: {
      rows: (europe?.results ?? []) as unknown as EuropeanFinances[],
      functions: (functions?.results ?? []) as unknown as {
        geo: string;
        year: number;
        function: string;
        spending: number;
        status: string | null;
      }[],
      provenance: index.provenance(
        [index.cite("eurostat-finances")],
        "Eurostat, secteur S13, en % du PIB : TE/TR (gov_10a_main), B9/GD (gov_10dd_edpt1), fonctions COFOG (gov_10a_exp). Dernière année commune aux six territoires. Les statuts de révision sont conservés dans les téléchargements.",
        "pipeline/sql/28_eurostat.sql",
      ),
    },
    debt: {
      row: (debt?.results[0] ?? null) as unknown as {
        period: string;
        amount: number;
        ratio: number;
        status: string | null;
      } | null,
      provenance: index.provenance(
        [index.cite("eurostat-finances")],
        "Eurostat gov_10q_ggdebt, France, secteur S13, dette brute consolidée à la fin du trimestre. Millions d’euros convertis en euros ; ratio annuel glissant publié par Eurostat.",
        "pipeline/sql/28_eurostat.sql",
      ),
    },
  };
}

export async function getSocialProtection() {
  const [benefits, sources] = await db().batch([
    db().prepare(
      "select year, risk as label, amount from social_benefits where year=(select max(year) from social_benefits) order by amount desc",
    ),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  return {
    rows: (benefits?.results ?? []) as unknown as NationalAmount[],
    provenance: index.provenance(
      [index.cite("drees-protection")],
      "DREES, comptes de la protection sociale, tous régimes. Six grands risques, sans leurs sous-totaux, rapprochés du total publié. Millions d’euros convertis en euros. Année 2024 semi-définitive selon le fichier téléchargé en octobre 2026.",
      "pipeline/sql/28_protection.sql",
    ),
  };
}

export interface SocialBranch {
  source_id: string;
  year: number;
  branch: string;
  label: string;
  stage: string;
  revenue: number;
  spending: number;
  balance: number;
}

interface SocialOndam extends NationalAmount {
  code: string;
  stage: string;
}

interface PensionIndicator {
  year: number;
  sex: string;
  recipients: number;
  monthly_pension: number;
}

interface UnemploymentAccount {
  year: number;
  revenue: number;
  spending: number;
  balance: number;
  exceptional: number;
  financial_balance: number;
  benefits: number;
  employment_services: number;
  debt: number;
}

export async function getSocialAccounts() {
  const [branches, ondam, health, pensions, family, unemployment, sources] = await db().batch([
    db().prepare("select * from social_branches order by year, source_id, spending desc"),
    db().prepare("select * from social_ondam order by year, amount desc"),
    db().prepare(
      "select * from health_payers where year=(select max(year) from health_payers) order by amount desc",
    ),
    db().prepare(
      "select * from pension_indicators where year=(select max(year) from pension_indicators) order by sex",
    ),
    db().prepare(
      "select * from family_benefits where year=(select max(year) from family_benefits) order by amount desc",
    ),
    db().prepare("select * from unemployment_accounts order by year"),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  const provenance = (id: string, method: string, sql: string) =>
    index.provenance([index.cite(id)], method, `pipeline/sql/${sql}.sql`);
  const branchProvenance = (id: string) =>
    provenance(
      id,
      "Comptes des régimes obligatoires de base. Tableaux 16 de la CCSS (2022-2027), 5 du PLFSS 2026 ou 6 du PLFSS 2027. Somme des soldes des cinq branches contrôlée contre le total publié. Recettes et dépenses totales consolidées, sans les transferts internes ; la somme brute des branches ne donne donc pas le total. FSV séparé jusqu'en 2025, supprimé en 2026. Millions d'euros convertis en euros. Arrondis publiés conservés.",
      "28a_social_branches",
    );
  return {
    branches: (branches?.results ?? []) as unknown as SocialBranch[],
    branchProvenance: {
      ccss: branchProvenance("ccss-octobre-2026"),
      project: branchProvenance("dss-branches-2027"),
      archive: branchProvenance("dss-branches-2026"),
    },
    ondam: {
      rows: (ondam?.results ?? []) as unknown as SocialOndam[],
      provenance: provenance(
        "dss-ondam-2026",
        "Annexe 5 du PLFSS 2026, tableaux I.2.1, I.3.3 et I.5.8 : constat 2024 d'octobre 2025, prévision 2025 et objectif proposé 2026. Six sous-objectifs rapprochés du total publié, avec une tolérance de 0,35 Md€ pour les arrondis au dixième de milliard.",
        "28c_social_ondam",
      ),
    },
    health: {
      rows: (health?.results ?? []) as unknown as (NationalAmount & { code: string })[],
      provenance: provenance(
        "drees-sante-financeurs",
        "DREES, comptes de la santé, dépense courante de santé au sens international. Poste total d00000 : cinq financeurs exclusifs (Sécurité sociale, administrations centrales et locales, complémentaires, ménages, entreprises), rapprochés du total publié. Montants en euros.",
        "28b_social_complements",
      ),
    },
    pensions: {
      rows: (pensions?.results ?? []) as unknown as PensionIndicator[],
      provenance: provenance(
        "drees-retraites",
        "Source : DREES, enquête annuelle auprès des caisses de retraite (EACR), enrichie avec le modèle ANCETRE. Classeur de mai 2026, onglet A-Cadrage : tous régimes, droits directs (ddir), ensemble des lieux de résidence, dernière estimation. Effectifs et pension mensuelle brute de droit direct (m1), hors réversion et majoration pour enfants. Les bénéficiaires ne sont pas additionnés entre caisses.",
        "28b_social_complements",
      ),
    },
    family: {
      rows: (family?.results ?? []) as unknown as NationalAmount[],
      provenance: provenance(
        "cnaf-depenses",
        "CNAF, tous régimes, France entière : prestations légales directes et sélection de postes sans doublon. Le total comprend aussi de petits postes non représentés. Contrôle France entière = métropole + DOM. Millions d'euros convertis en euros. Les caisses gèrent aussi des prestations financées par l'État et les départements.",
        "28b_social_complements",
      ),
    },
    unemployment: {
      rows: (unemployment?.results ?? []) as unknown as UnemploymentAccount[],
      provenance: provenance(
        "unedic-finances",
        "Unédic, recettes et dépenses annuelles. Composantes rapprochées des totaux publiés, solde technique = recettes − dépenses, solde financier = solde technique + éléments exceptionnels, avec une tolérance d'un million d'euros liée aux arrondis. Ce régime reste hors des cinq branches de la Sécurité sociale.",
        "28b_social_complements",
      ),
    },
  };
}

export interface ProcurementBreakdown {
  estimated: number;
  dimension: string;
  label: string;
  count: number;
  priced: number;
  amount: number;
}

export interface PublicationQuality {
  year: number;
  category: string;
  total: number;
  eligible: number;
  valid: number;
  on_time: number;
}

export interface ProcurementOpportunity {
  id: string;
  subject: string | null;
  buyer_siren: string | null;
  buyer_name: string;
  date: string;
  procedure: string | null;
  estimated_range: string | null;
  url: string | null;
}

export async function getProcurementOpportunities(siren?: string) {
  const buyer = siren ? " and buyer_siren = ?1" : "";
  const noticeQuery = db().prepare(`select *, deadline as date
    from procurement_notices where julianday(deadline) > julianday('now')${buyer}
    order by deadline limit 20`);
  const projectQuery = db().prepare(`select *, expected_on as date
    from procurement_projects where expected_on >= date('now')${buyer}
    order by expected_on limit 20`);
  const [notices, projects, sources] = await db().batch<Record<string, unknown>>([
    siren ? noticeQuery.bind(siren) : noticeQuery,
    siren ? projectQuery.bind(siren) : projectQuery,
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  const opportunities = (rows: unknown[], source: string) =>
    (rows as ProcurementOpportunity[]).map((row) => ({
      ...row,
      url: index.cite(source, { id: row.id }).recordUrl,
    }));
  return {
    notices: opportunities(notices?.results ?? [], "boamp"),
    projects: opportunities(projects?.results ?? [], "approch"),
    noticesProvenance: index.provenance(
      [index.cite("boamp"), index.cite("sirene")],
      "Avis avec échéance future, hors avis explicitement annulés lors de la collecte. Rapprochement par identifiant de l'acheteur dans le formulaire, jamais par nom. Les autres avis sont conservés avec un acheteur non identifié. Les fourchettes FNSimple gardent leurs bornes, sans moyenne ni addition. Les autres estimations restent dans l’avis officiel. Les rectificatifs ultérieurs doivent être vérifiés à la source. Les 20 prochaines échéances sont affichées.",
      "pipeline/sql/43_procurement_opportunities.sql",
    ),
    projectsProvenance: index.provenance(
      [index.cite("approch"), index.cite("sirene")],
      "Projets au statut Ouvert et à date prévisionnelle future. Acheteurs rapprochés par SIREN. Les 20 prochaines dates sont affichées. Les contacts ne sont pas republiés.",
      "pipeline/sql/43_procurement_opportunities.sql",
    ),
  };
}

export async function getProcurement() {
  const [
    breakdown,
    quality,
    latest,
    buyers,
    winners,
    departments,
    viewBox,
    sanctions,
    totals,
    companies,
    sources,
  ] = await db().batch<Record<string, unknown>>([
    db().prepare("select * from procurement_breakdown order by label"),
    db().prepare("select * from procurement_quality order by year, category"),
    db().prepare(`select c.*, coalesce(o.name, 'Acheteur non identifié') as buyer_name,
        f.url as source_url from procurement_latest c
        left join orgs o on o.siren = c.buyer_siren
        left join source_files f on f.id = c.source_file_id order by c.notified_on desc, c.uid`),
    db().prepare(
      "select siren, name, kind, awarded_amount as amount, awarded_count as count from orgs where awarded_count > 0 order by awarded_amount desc limit 10",
    ),
    db().prepare(
      "select siren, name, kind, won_amount as amount, won_count as count from orgs where won_count > 0 order by won_amount desc limit 10",
    ),
    db().prepare(
      "select code, name, path, label_x as labelX, label_y as labelY, label_size as labelSize from departements order by code",
    ),
    db().prepare("select value from build where key = 'france_viewbox'"),
    db().prepare("select * from competition_decisions order by year desc, id desc limit 12"),
    db().prepare(
      "select count(*) as count, sum(amount) as amount, min(year) as first, max(year) as last from competition_decisions",
    ),
    db().prepare(
      "select * from competition_companies where decision_id in (select id from competition_decisions order by year desc, id desc limit 12) order by amount desc, name",
    ),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  const provenance = index.provenance(
    [index.cite("decp"), index.cite("sirene")],
    "Un marché par identifiant uid. Valeurs retenues par version de modification décroissante, puis date de publication décroissante et identifiants stables. Mois de la notification initiale si disponible, sinon première notification connue. Avenants exclus de la datation quand une version initiale existe. Les montants signalés comme aberrants ou suspects par le consolidateur, absents, non positifs ou d’au moins 999 999 999 € ne sont pas comptés. Carte selon le département de l'acheteur, pas le lieu des travaux. Les classements reprennent les totaux par organisation, titulaires multiples à parts égales.",
    "pipeline/sql/41_procurement_overview.sql",
  );
  const companyRows = (companies?.results ?? []) as unknown as {
    decision_id: string;
    siren: string | null;
    name: string;
    amount: number | null;
  }[];
  return {
    breakdown: (breakdown?.results ?? []) as unknown as ProcurementBreakdown[],
    quality: (quality?.results ?? []) as unknown as PublicationQuality[],
    latest: ((latest?.results ?? []) as unknown as ContractRow[]).map(toContract),
    buyers: (buyers?.results ?? []) as unknown as RankedOrganisation[],
    winners: (winners?.results ?? []) as unknown as RankedOrganisation[],
    departments: (departments?.results ?? []) as unknown as DepartementSummary[],
    viewBox: (viewBox?.results[0]?.["value"] as string | undefined) ?? "0 0 0 0",
    provenance,
    mapProvenance: index.provenance(
      [...provenance.citations, index.cite("contours-departements")],
      provenance.method,
      "pipeline/sql/41_procurement_overview.sql",
    ),
    qualityProvenance: index.provenance(
      [index.cite("decp"), index.cite("decp-publication-method"), index.cite("sirene")],
      "Versions initiales modification_id = 0 uniquement. Montant initial de 40 000 € HT ou plus, non signalé et inférieur à 999 999 999 €. Notification depuis 2019 et délai de deux mois calendaires entièrement écoulé à la collecte. datePublicationDonnees est la date déclarée de publication des données, pas la collecte ni la notification. Dates manquantes, antérieures à la notification ou postérieures à la collecte exclues du taux mais dénombrées. Catégories issues de la catégorie juridique Sirene. Mesure des seuls contrats publiés et disposant d'une version initiale, sans mesure des marchés jamais publiés.",
      "pipeline/sql/42_procurement_quality.sql",
    ),
    sanctions: (
      (sanctions?.results ?? []) as unknown as {
        id: string;
        year: number;
        amount: number;
        company_rows: number;
      }[]
    ).map((row) => ({
      ...row,
      url: index.cite("competition-sanctions", { id: row.id }).recordUrl,
      companies: companyRows.filter((company) => company.decision_id === row.id),
    })),
    sanctionTotals: totals?.results[0] as unknown as {
      count: number;
      amount: number;
      first: number;
      last: number;
    },
    sanctionsProvenance: index.provenance(
      [index.cite("competition-sanctions"), index.cite("sirene")],
      "Montant total compté une fois par décision. Sanctions initiales avant recours, toutes activités confondues. Les lignes individuelles peuvent être solidaires et ne s'additionnent pas. Noms rapprochés exactement après normalisation de la casse, des accents et de la ponctuation, uniquement quand une seule personne morale diffusible de Sirene correspond. Autres noms masqués. Les 12 décisions les plus récentes sont affichées.",
      "pipeline/sql/44_competition_sanctions.sql",
    ),
    asOf: index.get("boamp").retrievedAt,
  };
}

export interface LobbyingOrganisation {
  id: string;
  identifier: string;
  siren: string | null;
  name: string;
  activities: number;
  declared_activities: number | null;
  activities_reconciled: number | null;
  budget_label: string | null;
  starts_on: string | null;
  ends_on: string | null;
  provenance: Provenance;
}

export interface EuropeanLobbying {
  id: string;
  name: string;
  siren: string | null;
  starts_on: string;
  ends_on: string;
  cost_min: number | null;
  cost_max: number | null;
  cost_exact: number | null;
  areas: string;
  provenance: Provenance;
}

const LOBBYING_SQL = "pipeline/sql/42_lobbying.sql";
const PARTY_SQL = "pipeline/sql/43_political_finance.sql";
const LOBBYING_METHOD =
  "Personnes morales vérifiées par Sirene (catégorie différente de 1000, diffusion ouverte) ou association avec RNA. Fiches publiées pendant les 12 mois précédant la récupération, pas actions réalisées pendant cette période. Une fiche peut viser plusieurs institutions. Fourchette du dernier exercice clos et publié, années variables. Le nombre de fiches réellement présentes est utilisé ; le nombre annoncé par exercice est conservé séparément avec un indicateur de rapprochement.";
const EU_METHOD =
  "Siège en France et forme juridique de personne morale reconnue. Dernier exercice déclaré, année indiquée par ligne. Coûts de représentation d’intérêts uniquement, pas budget total. Rapprochement SIREN via un nom normalisé identique et unique dans chaque registre, pays France, sans rapprochement approximatif.";

async function democracySources() {
  const result = await db().prepare(SOURCES_QUERY).all<SourceRow>();
  return new SourceIndex(result.results);
}

function lobbyingRow(index: SourceIndex, row: Omit<LobbyingOrganisation, "provenance">) {
  return {
    ...row,
    provenance: index.provenance(
      [index.cite("hatvp-agora", { identifier: row.identifier })],
      LOBBYING_METHOD,
      LOBBYING_SQL,
    ),
  };
}

function europeanRow(index: SourceIndex, row: Omit<EuropeanLobbying, "provenance">) {
  return {
    ...row,
    provenance: index.provenance(
      [index.cite("eu-transparency", { identifier: row.id })],
      EU_METHOD,
      LOBBYING_SQL,
    ),
  };
}

const EUROPEAN_LOBBYING_QUERY = `select e.id, e.name,
  case when e.siren in (select siren from orgs) then e.siren end as siren,
  e.starts_on, e.ends_on, e.cost_min, e.cost_max, e.cost_exact,
  coalesce((select group_concat(area, ' · ') from eu_lobbying_interests
    where organisation_id = e.id), '') as areas from eu_lobbying e`;

export async function getLobbying(query = "") {
  const index = await democracySources();
  const asOf = index.get("hatvp-agora").retrievedAt!.slice(0, 10);
  const filter = `%${query.trim().slice(0, 100)}%`;
  const [
    totals,
    organisations,
    targets,
    ministries,
    quarters,
    budgets,
    defaults,
    crosses,
    european,
    areas,
  ] = await Promise.all([
    db()
      .prepare(
        `select
        (select count(*) from lobbying_organisations) as organisations,
        (select sum(activities) from lobbying_recent) as activities,
        (select count(*) from lobbying_defaults) as defaults,
        (select count(*) from lobbying_crossrefs) as crossrefs,
        (select count(*) from eu_lobbying) as european`,
      )
      .first<{
        organisations: number;
        activities: number;
        defaults: number;
        crossrefs: number;
        european: number;
      }>(),
    db()
      .prepare(
        `select o.id, o.identifier,
        case when o.siren in (select siren from orgs) then o.siren end as siren,
        o.name, coalesce(r.activities, 0) as activities,
        e.declared_activities, e.activities_reconciled, e.budget_label, e.starts_on, e.ends_on from lobbying_organisations o
        left join lobbying_recent r on r.organisation_id = o.id
        left join lobbying_latest e on e.organisation_id = o.id
        where o.name like ? order by activities desc, o.name limit 10`,
      )
      .bind(filter)
      .all<Omit<LobbyingOrganisation, "provenance">>(),
    db()
      .prepare(
        `select t.label, count(distinct t.activity_id) as count from lobbying_targets t
        join lobbying_activities a on a.id = t.activity_id
        where t.kind = 'institution' and a.published_on > date(?1, '-1 year') and a.published_on <= ?1
        group by t.label order by count desc`,
      )
      .bind(asOf)
      .all<{ label: string; count: number }>(),
    db()
      .prepare(
        `select t.label, count(distinct t.activity_id) as count from lobbying_targets t
        join lobbying_activities a on a.id = t.activity_id
        where t.kind = 'ministry' and a.published_on > date(?1, '-1 year') and a.published_on <= ?1
        group by t.label order by count desc limit 12`,
      )
      .bind(asOf)
      .all<{ label: string; count: number }>(),
    db()
      .prepare(
        "select * from (select * from lobbying_quarters order by year desc, quarter desc limit 8) order by year, quarter",
      )
      .all<{ year: number; quarter: number; activities: number }>(),
    db()
      .prepare(
        `select budget_label as label, count(*) as count from lobbying_latest
        where budget_label is not null group by budget_label order by min(budget_min)`,
      )
      .all<{ label: string; count: number }>(),
    db()
      .prepare(
        `select o.name, o.identifier, o.siren, d.period, d.missing from lobbying_defaults d
        join lobbying_organisations o on o.id = d.organisation_id
        where o.name like ? order by o.name`,
      )
      .bind(filter)
      .all<{
        name: string;
        identifier: string;
        siren: string | null;
        period: string;
        missing: string;
      }>(),
    db()
      .prepare(
        `select o.name, c.* from lobbying_crossrefs c
        join lobbying_organisations o on o.id = c.organisation_id
        where o.name like ? order by c.contracts desc, c.payments desc limit 10`,
      )
      .bind(filter)
      .all<{
        name: string;
        siren: string;
        contracts: number;
        contract_amount: number;
        payments: number;
        payment_amount: number;
      }>(),
    db()
      .prepare(
        `${EUROPEAN_LOBBYING_QUERY} where e.name like ?
        order by coalesce(e.cost_exact, e.cost_min, 0) desc, e.name limit 10`,
      )
      .bind(filter)
      .all<Omit<EuropeanLobbying, "provenance">>(),
    db()
      .prepare(
        `select area as label, count(*) as count from eu_lobbying_interests
        group by area order by count desc limit 10`,
      )
      .all<{ label: string; count: number }>(),
  ]);
  return {
    totals: totals!,
    asOf,
    organisations: organisations.results.map((row) => lobbyingRow(index, row)),
    targets: targets.results,
    ministries: ministries.results,
    quarters: quarters.results,
    budgets: budgets.results,
    defaults: defaults.results,
    crosses: crosses.results,
    european: european.results.map((row) => europeanRow(index, row)),
    areas: areas.results,
    provenance: index.provenance(
      [index.cite("hatvp-agora"), index.cite("sirene")],
      LOBBYING_METHOD,
      LOBBYING_SQL,
    ),
    defaultsProvenance: index.provenance(
      [index.cite("hatvp-defaults")],
      "Troisième liste du fichier stock.json utilisé par l’annuaire officiel HATVP. Personnes morales vérifiées uniquement. État à la date de récupération, pas une condamnation.",
      LOBBYING_SQL,
    ),
    defaultsUrl: index.get("hatvp-defaults").pageUrl,
    crossProvenance: index.provenance(
      [index.cite("hatvp-agora"), index.cite("decp"), index.cite("jaune-associations")],
      "Jointure exacte par SIREN. Marchés notifiés depuis 2019, dernière version, montants partagés entre cotitulaires. Versements de l’État en 2025. Périodes distinctes des déclarations HATVP, aucun lien causal établi.",
      LOBBYING_SQL,
    ),
    europeanProvenance: index.provenance([index.cite("eu-transparency")], EU_METHOD, LOBBYING_SQL),
  };
}

export async function getOrganisationLobbying(siren: string) {
  const index = await democracySources();
  const [french, european, targets] = await Promise.all([
    db()
      .prepare(
        `select o.id, o.identifier, o.siren, o.name, coalesce(e.activities, 0) as activities,
      e.declared_activities, e.activities_reconciled, e.budget_label, e.starts_on, e.ends_on from lobbying_organisations o
      left join lobbying_latest e on e.organisation_id = o.id where o.siren = ?`,
      )
      .bind(siren)
      .all<Omit<LobbyingOrganisation, "provenance">>(),
    db()
      .prepare(`${EUROPEAN_LOBBYING_QUERY} where e.siren = ?`)
      .bind(siren)
      .all<Omit<EuropeanLobbying, "provenance">>(),
    db()
      .prepare(
        `select t.label, count(distinct t.activity_id) as count from lobbying_targets t
      join lobbying_activities a on a.id = t.activity_id
      join lobbying_latest e on e.id = a.exercise_id
      join lobbying_organisations o on o.id = e.organisation_id
      where o.siren = ? and t.kind = 'institution' group by t.label order by count desc`,
      )
      .bind(siren)
      .all<{ label: string; count: number }>(),
  ]);
  return {
    french: french.results.map((row) => lobbyingRow(index, row)),
    european: european.results.map((row) => europeanRow(index, row)),
    targets: targets.results,
  };
}

export interface PartyAccount {
  code: string;
  name: string;
  year: number;
  members: number;
  elected: number;
  donations: number;
  public_aid: number;
  public_first: number;
  public_second: number;
  public_other: number;
  other_resources: number;
  resources: number;
  reconciled: number;
  component_difference: number;
  majority_public: number;
}

export async function getPoliticalFinance(code: string | null) {
  const index = await democracySources();
  const [accounts, history, losses] = await Promise.all([
    db()
      .prepare("select * from party_accounts where year = 2024 order by resources desc, name")
      .all<PartyAccount>(),
    db().prepare("select * from party_accounts order by code, year").all<PartyAccount>(),
    db()
      .prepare("select * from party_aid_losses order by name")
      .all<{ code: string; name: string; exercise: number; reason: string; until_date: string }>(),
  ]);
  const selected = accounts.results.find((row) => row.code === code) ?? accounts.results[0]!;
  return {
    accounts: accounts.results,
    history: history.results,
    selected,
    selectedHistory: history.results.filter((row) => row.code === selected.code),
    losses: losses.results,
    provenance: index.provenance(
      [index.cite("cnccfp-parties")],
      "Comptes en euros seulement. Produits totaux du compte de résultat, contributions, dons agrégés et aides publiques (deux fractions et autres aides). Autres ressources : solde des produits. Comptes non consolidés entre partis. Trois comptes 2023 exclus : deux en XPF, un sans monnaie. Un compte du fichier 2021 indiquant 2022 est aussi exclu. Les écarts supérieurs à un euro entre les composantes et les produits déclarés sont signalés et exclus des alertes de majorité publique.",
      PARTY_SQL,
    ),
    lossesProvenance: index.provenance(
      [index.cite("cnccfp-status")],
      "Seules les lignes portant une date explicite de fin de perte de l’aide publique sont retenues. Motif officiel repris sous forme de code, sans déduction à partir d’une absence de versement. Décisions sur l’exercice 2024, état au téléchargement.",
      PARTY_SQL,
    ),
    decree: index.get("jorf-party-aid"),
  };
}

export interface OfficialJournal {
  id: string;
  publication_date: string;
  issue_number: string;
  source_reference_count: number;
  excluded_reference_count: number;
  missing_reference_count: number;
  public_text_count: number;
  coverage_status: string;
}

export interface OfficialText {
  id: string;
  publication_date: string;
  nature: string;
  title_public: string;
  nor: string | null;
  ministry_label: string;
  authority_label: string | null;
  appointment_class: string;
  record_url: string;
}

interface DocumentCount {
  label: string;
  count: number;
}

function documentPage(params: URLSearchParams): number {
  const value = Number(params.get("page") ?? 1);
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, 100000) : 1;
}

async function documentProvenance(ids: string[], method: string, calculation: string) {
  const { results } = await db().prepare(SOURCES_QUERY).all<SourceRow>();
  const index = new SourceIndex(results);
  return index.provenance(
    ids.map((id) => index.cite(id)),
    method,
    calculation,
  );
}

export async function getOfficialJournal(params: URLSearchParams) {
  const filters: string[] = [];
  const values: string[] = [];
  for (const [param, column] of [
    ["date", "publication_date"],
    ["nature", "nature"],
    ["ministere", "ministry_label"],
    ["classe", "appointment_class"],
  ]) {
    const value = params.get(param!);
    if (value) {
      filters.push(`${column} = ?`);
      values.push(value);
    }
  }
  const where = filters.length ? `where ${filters.join(" and ")}` : "";
  const page = documentPage(params);
  const [journals, texts, total, natures, ministries, appointments, days, provenance] =
    await Promise.all([
      db()
        .prepare("select * from official_journals order by publication_date desc")
        .all<OfficialJournal>(),
      db()
        .prepare(
          `select * from official_texts ${where} order by publication_date desc, id limit 40 offset ?`,
        )
        .bind(...values, (page - 1) * 40)
        .all<OfficialText>(),
      db()
        .prepare(`select count(*) as count from official_texts ${where}`)
        .bind(...values)
        .first<{ count: number }>(),
      db()
        .prepare(
          "select nature as label, count(*) as count from official_texts group by nature order by count desc",
        )
        .all<DocumentCount>(),
      db()
        .prepare(
          "select distinct ministry_label as label from official_texts order by ministry_label",
        )
        .all<{ label: string }>(),
      db()
        .prepare(
          "select ministry_label as label, count(*) as count from official_texts where appointment_class = 'nomination' group by ministry_label order by count desc",
        )
        .all<DocumentCount>(),
      db()
        .prepare(
          "select publication_date as label, count(*) as count from official_texts group by publication_date order by publication_date",
        )
        .all<DocumentCount>(),
      documentProvenance(
        ["jorfsimple"],
        "30 dernières éditions présentes dans 50 jours de livraisons DILA, dédupliquées par identifiant. Stock historique non reconstitué. Les références protégées sont exclues avant export. Les références sans XML disponible ne sont pas comptées. Une nomination est un texte dont le titre annonce une nomination, pas un nombre de personnes. Les désignations, retraites et cessations sont distinctes. Le ministère du texte est prioritaire ; à défaut, celui du sommaire est utilisé sans déduction du NOR.",
        "pipeline/sql/65_official_journals.sql",
      ),
    ]);
  const latestDate = journals.results[0]?.publication_date;
  const latestAppointments = latestDate
    ? await db()
        .prepare(
          "select count(*) as count from official_texts where publication_date = ? and appointment_class = 'nomination'",
        )
        .bind(latestDate)
        .first<{ count: number }>()
    : null;
  return {
    journals: journals.results,
    texts: texts.results,
    total: total?.count ?? 0,
    page,
    natures: natures.results,
    ministries: ministries.results,
    appointments: appointments.results,
    days: days.results,
    latestAppointments: latestAppointments?.count ?? 0,
    provenance,
  };
}

export interface LegislativeFile {
  id: string;
  title_public: string;
  kind: string;
  legislature: string | null;
  status: string;
  source_id: string;
  source_modified_at: string | null;
  record_url: string;
}

export interface LegislativeEvent {
  id: string;
  parent_id: string | null;
  chamber: string;
  label_public: string;
  event_at: string | null;
  temporal_status: string;
  outcome: string | null;
  record_url: string;
  source_id: string;
}

export async function getLegislativeFiles(params: URLSearchParams) {
  const filters: string[] = [];
  const values: (string | number)[] = [];
  if (params.get("q")) {
    filters.push("title_public like ?");
    values.push(`%${params.get("q")}%`);
  }
  for (const [param, column] of [
    ["source", "source_id"],
    ["statut", "status"],
    ["legislature", "legislature"],
  ]) {
    if (params.get(param!)) {
      filters.push(`${column} = ?`);
      values.push(params.get(param!)!);
    }
  }
  if (params.get("finances") === "1")
    filters.push("id in (select file_id from budget_legislation)");
  const where = filters.length ? `where ${filters.join(" and ")}` : "";
  const page = documentPage(params);
  const [rows, total, counts, provenance] = await Promise.all([
    db()
      .prepare(
        `select * from legislative_files ${where} order by coalesce(source_modified_at, '') desc, title_public limit 40 offset ?`,
      )
      .bind(...values, (page - 1) * 40)
      .all<LegislativeFile>(),
    db()
      .prepare(`select count(*) as count from legislative_files ${where}`)
      .bind(...values)
      .first<{ count: number }>(),
    db()
      .prepare(
        "select source_id as label, count(*) as count from legislative_files group by source_id",
      )
      .all<DocumentCount>(),
    documentProvenance(
      ["dole", "an-dossiers", "senat-dosleg"],
      "Notices distinctes par producteur, sans fusion approximative : une même loi peut apparaître plusieurs fois. DOLE : stock et incréments. Assemblée : dossiers de loi de la XVIIe législature. Sénat : projets et propositions du fonds DOSLEG. Le statut de chaque producteur est conservé. Une étape sans date reste indéterminée ; une date future est annoncée. Les documents restent sur les sites officiels.",
      "pipeline/sql/66_legislative_files.sql",
    ),
  ]);
  return { rows: rows.results, total: total?.count ?? 0, page, counts: counts.results, provenance };
}

export async function getLegislativeFile(id: string) {
  const file = await db()
    .prepare("select * from legislative_files where id = ?")
    .bind(id)
    .first<LegislativeFile>();
  if (!file) return null;
  const [events, documents, related, provenance] = await Promise.all([
    db()
      .prepare(
        "select * from legislative_events where file_id = ? order by event_at is null, event_at, source_order",
      )
      .bind(id)
      .all<LegislativeEvent>(),
    db()
      .prepare("select title_public, record_url from legislative_documents where file_id = ?")
      .bind(id)
      .all<{ title_public: string; record_url: string }>(),
    db()
      .prepare(
        "select distinct f.id, f.title_public, f.source_id from legislative_files f join legislative_events e on replace(e.record_url, 'http:', 'https:') = replace(f.record_url, 'http:', 'https:') where e.file_id = ? and f.id != ?",
      )
      .bind(id, id)
      .all<Pick<LegislativeFile, "id" | "title_public" | "source_id">>(),
    documentProvenance(
      [file.source_id],
      "Étapes et liens du producteur. La date de modification du dossier ne remplace pas la date d'une étape. Les événements futurs sont annoncés. Un statut inconnu est conservé. Les noms d'agents et pièces jointes ne sont pas recopiés.",
      "pipeline/sql/66_legislative_files.sql",
    ),
  ]);
  return {
    file,
    events: events.results,
    documents: documents.results,
    related: related.results,
    provenance,
  };
}

export async function getBudgetLegislation(family: string) {
  const { results } = await db()
    .prepare(
      "select f.*, b.fiscal_year, b.law_kind from budget_legislation b join legislative_files f on f.id = b.file_id where b.budget_family = ? and b.fiscal_year >= 2025 order by b.fiscal_year desc, b.law_kind, f.source_id",
    )
    .bind(family)
    .all<LegislativeFile & { fiscal_year: number; law_kind: string }>();
  return results;
}

export interface Administration {
  id: string;
  name_public: string;
  acronym: string | null;
  category: string;
  organism_type: string | null;
  head_name: string | null;
  head_role: string | null;
  siren: string | null;
  commune_code: string | null;
  record_url: string | null;
  source_modified_at: string | null;
  source_id: string;
}

export async function getAdministrations(params: URLSearchParams) {
  const page = documentPage(params);
  const values: string[] = [];
  const filters: string[] = [];
  if (params.get("q")) {
    filters.push("name_public like ?");
    values.push(`%${params.get("q")}%`);
  }
  if (params.get("categorie")) {
    filters.push("category = ?");
    values.push(params.get("categorie")!);
  }
  if (params.get("gouvernement") === "1") {
    filters.push("head_name is not null and head_role != 'Président de la République'");
  }
  const where = filters.length ? `where ${filters.join(" and ")}` : "";
  const [rows, total, categories, provenance] = await Promise.all([
    db()
      .prepare(`select * from administrations ${where} order by name_public limit 40 offset ?`)
      .bind(...values, (page - 1) * 40)
      .all<Administration>(),
    db()
      .prepare(`select count(*) as count from administrations ${where}`)
      .bind(...values)
      .first<{ count: number }>(),
    db()
      .prepare(
        "select category as label, count(*) as count from administrations group by category order by category",
      )
      .all<DocumentCount>(),
    documentProvenance(
      ["roae", "annuaire-etat"],
      "ROAE national et préfectures/sous-préfectures de l'annuaire DILA, dédupliqués par UUID. Seuls nom, sigle, catégorie, identifiants institutionnels, rattachements et lien officiel sont publiés. Seuls le président de la République et les membres du gouvernement du ROAE sont nommés dans leur rôle public. La présence d'un service ne prouve ni compétence territoriale ni budget propre. Les ministères et directions sont repérés par leur nom, pas par le type générique Administration centrale.",
      "pipeline/sql/67_administrations.sql",
    ),
  ]);
  return {
    rows: rows.results,
    total: total?.count ?? 0,
    page,
    categories: categories.results,
    provenance,
  };
}

export async function getAdministration(id: string) {
  const row = await db()
    .prepare("select * from administrations where id = ?")
    .bind(id)
    .first<Administration>();
  if (!row) return null;
  const [parents, children, coverage, provenance] = await Promise.all([
    db()
      .prepare(
        "select distinct a.* from administrations a join administration_relations r on r.parent_id = a.id where r.child_id = ? order by a.name_public",
      )
      .bind(id)
      .all<Administration>(),
    db()
      .prepare(
        "select distinct a.* from administrations a join administration_relations r on r.child_id = a.id where r.parent_id = ? order by a.name_public",
      )
      .bind(id)
      .all<Administration>(),
    db()
      .prepare(
        "select distinct c.insee, c.name from communes c join administration_coverage a on a.commune_code = c.insee where a.administration_id = ? order by c.name",
      )
      .bind(id)
      .all<{ insee: string; name: string }>(),
    documentProvenance(
      [row.source_id, "annuaire-competence"],
      "Fiche institutionnelle diffusée par DILA. Seuls le président de la République et les membres du gouvernement sont nommés dans leur rôle public, à la date de la source. Les autres responsables, les coordonnées et les champs libres sont exclus. Les liens d'organisation conservent les rattachements multiples. Un identifiant SIREN absent reste absent.",
      "pipeline/sql/67_administrations.sql",
    ),
  ]);
  return {
    row,
    parents: parents.results,
    children: children.results,
    coverage: coverage.results,
    provenance,
  };
}

export function documentPublisher(sourceId: string): string {
  return (
    {
      dole: "DILA / DOLE",
      "an-dossiers": "Assemblée nationale",
      "senat-dosleg": "Sénat",
      roae: "DILA / ROAE",
      "annuaire-etat": "Annuaire DILA",
    }[sourceId] ?? sourceId
  );
}

export function documentKind(kind: string): string {
  return (
    (
      {
        LOI_PUBLIEE: "Loi publiée",
        PROJET_LOI: "Projet de loi",
        ORDONNANCE: "Ordonnance",
        pjl: "Projet de loi",
        ppl: "Proposition de loi",
        pplo: "Proposition de loi organique",
        pplc: "Proposition de loi constitutionnelle",
        pjlo: "Projet de loi organique",
        pjlc: "Projet de loi constitutionnelle",
        pjlf: "Projet de loi de finances",
        pjfs: "Projet de financement de la sécurité sociale",
        pjlr: "Projet de loi de finances rectificative",
        pjlg: "Projet de loi de résultats ou de règlement",
        pfsr: "Financement rectificatif de la sécurité sociale",
        cvn: "Ratification d'un traité ou d'une convention",
      } as Record<string, string>
    )[kind] ?? kind
  );
}

export interface ProcurementCompetitionMetric {
  total: number;
  known: number;
  single_bid: number;
}

export interface ProcurementCompetitionGroup extends ProcurementCompetitionMetric {
  label: string;
  name: string;
}

export async function getProcurementCompetition(siren?: string) {
  const [summary, buyers, sectors, sources] = await db().batch<Record<string, unknown>>([
    db()
      .prepare(
        "select total, known, single_bid from procurement_competition where dimension = ?1 and label = ?2",
      )
      .bind(siren ? "buyer" : "national", siren ?? ""),
    db()
      .prepare(
        `select p.*, o.name from procurement_competition p join orgs o on o.siren = p.label
      where p.dimension = 'buyer' and ?1 = '' order by p.known desc, o.name limit 10`,
      )
      .bind(siren ?? ""),
    db()
      .prepare(
        `select *, case when label = 'Non renseignée' then label else 'CPV ' || label end as name
      from procurement_competition where dimension = 'sector' and ?1 = ''
      order by known desc, label limit 12`,
      )
      .bind(siren ?? ""),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  return {
    summary: (summary?.results[0] as unknown as ProcurementCompetitionMetric | undefined) ?? {
      total: 0,
      known: 0,
      single_bid: 0,
    },
    buyers: (buyers?.results ?? []) as unknown as ProcurementCompetitionGroup[],
    sectors: (sectors?.results ?? []) as unknown as ProcurementCompetitionGroup[],
    provenance: index.provenance(
      [index.cite("decp"), index.cite("sirene")],
      "Un marché par uid, notification initiale depuis 2024, dernière version connue. Le dénominateur comprend uniquement les nombres d’offres strictement positifs et concordants entre cotitulaires. Zéros, absences et nombres contradictoires sont exclus du taux, mais restent dans la couverture. Familles d’achat : deux premiers chiffres du CPV ; familles discordantes classées non renseignées. Dix acheteurs et douze familles ayant le plus de nombres d’offres connus sont affichés. Les marchés jamais publiés ne sont pas mesurés.",
      "pipeline/sql/45_procurement_competition.sql",
    ),
  };
}

export interface LocalAccount {
  level: "departement" | "region" | "epci";
  code: string;
  name: string;
  siren: string;
  category: string;
  year: number;
  population: number | null;
  spending: number | null;
  operating: number | null;
  investment: number | null;
  revenue: number | null;
  debt: number | null;
  spendingPerCapita: number | null;
  revenuePerCapita: number | null;
  debtPerCapita: number | null;
}

const LOCAL_ACCOUNTS_QUERY = `select level, code, name, siren, category, year, population,
  spending, operating, investment, revenue, debt, spending_per_capita as spendingPerCapita,
  revenue_per_capita as revenuePerCapita, debt_per_capita as debtPerCapita from local_accounts`;

const localSource = (level: LocalAccount["level"]) =>
  `ofgl-${{ departement: "departements", region: "regions", epci: "epci" }[level]}`;

function localProvenance(index: SourceIndex, level: LocalAccount["level"], row?: LocalAccount) {
  return index.provenance(
    [index.cite(localSource(level), row ? { siren: row.siren, year: row.year } : {})],
    "Budgets principaux et annexes consolidés par l’OFGL. Dépenses hors remboursement de la dette, recettes hors emprunts. Euros courants et population totale Insee de l’exercice. Niveaux séparés, sans addition entre collectivités.",
    "pipeline/sql/51_local_accounts.sql",
  );
}

export async function getLocalAccounts(level: LocalAccount["level"], year = 2025) {
  const [accounts, sources] = await db().batch([
    db()
      .prepare(`${LOCAL_ACCOUNTS_QUERY} where level = ?1 and year = ?2 order by name`)
      .bind(level, year),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  return {
    year,
    accounts: ((accounts?.results ?? []) as unknown as LocalAccount[]).map((row) => ({
      ...row,
      provenance: localProvenance(index, level, row),
    })),
    provenance: localProvenance(index, level),
  };
}

export async function getDepartmentLocal(code: string) {
  const region =
    ({ "2A": "94", "2B": "94", "972": "02", "973": "03" } as Record<string, string>)[code] ?? "";
  const alsace = code === "67" || code === "68" ? "67A" : "";
  const [accounts, sources] = await db().batch([
    db()
      .prepare(
        `${LOCAL_ACCOUNTS_QUERY}
      where (level = 'departement' and code in (?1, ?2, ?3))
         or (level = 'region' and code = ?4) order by year, name`,
      )
      .bind(code, alsace, code === "69" ? "691" : "", region),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  const rows = (accounts?.results ?? []) as unknown as LocalAccount[];
  const authorities = [...new Set(rows.map((row) => row.siren))].map((siren) => {
    const history = rows.filter((row) => row.siren === siren);
    const latest = history.at(-1)!;
    return { latest, history, provenance: localProvenance(index, latest.level, latest) };
  });
  return {
    authorities: authorities.filter(
      ({ latest }) => latest.year === Math.max(...rows.map((row) => row.year)),
    ),
    turnout: await getLocalTurnout("department_code", code),
  };
}

export interface LocalTurnout {
  sourceId: string;
  label: string;
  registered: number | null;
  voters: number | null;
  turnout: number | null;
  excludedCommunes: number;
}

async function getLocalTurnout(
  column: "insee" | "department_code",
  code: string,
): Promise<{ rows: LocalTurnout[]; provenance: Provenance }> {
  const table = column === "insee" ? "commune_turnout" : "department_turnout";
  const [turnout, sources] = await db().batch([
    db()
      .prepare(
        `select source_id as sourceId, registered, voters, turnout, excluded_communes as excludedCommunes from ${table}
      where ${column} = ?1 order by source_id desc`,
      )
      .bind(code),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  const rows = ((turnout?.results ?? []) as unknown as Omit<LocalTurnout, "label">[]).map(
    (row) => ({ ...row, label: index.get(row.sourceId).name }),
  );
  return {
    rows,
    provenance: index.provenance(
      rows.map((row) => index.cite(row.sourceId)),
      "Votants divisés par inscrits, multipliés par 100. Le taux départemental est calculé sur la somme des effectifs, sans moyenne des taux communaux. Le second tour porte seulement sur les électeurs appelés à voter. Les effectifs incohérents sont exclus et signalés.",
      "pipeline/sql/54_local_turnout.sql",
    ),
  };
}

export interface LocalTax {
  tax: string;
  authority: string;
  zone: string;
  authorityName: string | null;
  authoritySiren: string | null;
  base: number | null;
  rate: number | null;
  surtaxRate: number | null;
  medianRate: number | null;
  basePerCapita: number | null;
  medianBasePerCapita: number | null;
  peers: number | null;
}

export interface CommuneIncome {
  revenueYear: number;
  households: number | null;
  taxableHouseholds: number | null;
  referenceIncome: number | null;
  netTax: number | null;
}

export async function getCommuneLocal(insee: string) {
  const [taxes, income, dgf, sources] = await db().batch([
    db()
      .prepare(
        `select t.tax, t.authority, t.zone, t.authority_name as authorityName,
      t.authority_siren as authoritySiren, t.base, t.rate, t.surtax_rate as surtaxRate,
      s.median_rate as medianRate, t.base / nullif(c.population, 0) as basePerCapita,
      s.median_base_per_capita as medianBasePerCapita, s.communes as peers
      from commune_taxes t left join commune_years c on c.insee = t.insee and c.year = t.year
      left join tax_strata s on s.stratum = c.stratum and s.year = t.year
        and s.tax = t.tax and s.authority = t.authority and s.zone = t.zone
      where t.insee = ?1 order by t.tax, t.authority, t.zone`,
      )
      .bind(insee),
    db()
      .prepare(
        `select revenue_year as revenueYear, households, taxable_households as taxableHouseholds,
      reference_income as referenceIncome, net_tax as netTax from commune_income where insee = ?1`,
      )
      .bind(insee),
    db()
      .prepare(
        "select year, amount, per_capita as perCapita from commune_finances where insee = ?1 and item = 'dgf' order by year",
      )
      .bind(insee),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  return {
    dgf: (dgf?.results ?? []) as unknown as {
      year: number;
      amount: number;
      perCapita: number | null;
    }[],
    allocationSource: index.get("dgcl-dotations-2026"),
    dgfProvenance: index.provenance(
      [index.cite("ofgl-communes", { insee, year: 2025 })],
      "Dotation globale de fonctionnement comptabilisée dans les comptes communaux consolidés. Ces montants exécutés ne sont pas les allocations notifiées pour 2026.",
      "pipeline/sql/51_local_accounts.sql",
    ),
    taxes: (taxes?.results ?? []) as unknown as LocalTax[],
    income: (income?.results[0] as unknown as CommuneIncome | undefined) ?? null,
    turnout: await getLocalTurnout("insee", insee),
    taxProvenance: index.provenance(
      [index.cite("rei-2025")],
      "REI 2025 : bases nettes en euros et taux applicables en pourcentage, par bénéficiaire et zone. Médiane des communes de même strate de population OFGL 2025, à base positive, pour la même taxe, le même type de bénéficiaire et la même zone.",
      "pipeline/sql/52_local_taxes.sql",
    ),
    incomeProvenance: index.provenance(
      [index.cite("ircom-2025")],
      "Lignes Total du fichier IRCOM, revenus 2024 déclarés en 2025. Montants en milliers d’euros convertis en euros. Arrondissements municipaux regroupés sans reconstituer les cellules secrètes. Impôt net après crédits d’impôt, pouvant être négatif.",
      "pipeline/sql/53_local_income.sql",
    ),
  };
}

export async function getCommuneDgfHistory() {
  const [history, sources] = await db().batch([
    db().prepare("select year, amount, communes from commune_dgf_history order by year"),
    db().prepare(SOURCES_QUERY),
  ]);
  const index = new SourceIndex((sources?.results ?? []) as unknown as SourceRow[]);
  return {
    history: (history?.results ?? []) as unknown as {
      year: number;
      amount: number;
      communes: number;
    }[],
    provenance: index.provenance(
      [index.cite("ofgl-communes")],
      "Somme de la dotation globale de fonctionnement comptabilisée dans les comptes communaux consolidés. Ce sont des comptes exécutés, distincts des allocations notifiées par la DGCL. Couverture variable selon l’exercice.",
      "pipeline/sql/51_local_accounts.sql",
    ),
  };
}

export interface PublicPerson {
  id: string;
  given_name: string;
  family_name: string;
  display_name: string;
  role_kind: string;
  chamber: string;
  territory_code: string | null;
  territory_label: string | null;
  group_label: string | null;
  active: number;
  hatvp_ref: string | null;
  source_id: string;
}

export interface PublicMandate {
  id: string;
  kind: string;
  chamber: string;
  role_label: string | null;
  organ_label: string | null;
  starts_on: string | null;
  ends_on: string | null;
  date_precision: string;
  territory_label: string | null;
}

export interface PublicBallot {
  id: string;
  chamber: string;
  number: number;
  session: string;
  voted_on: string;
  title: string;
  result: string | null;
  for_count: number | null;
  against_count: number | null;
  abstention_count: number | null;
  non_voting_count: number | null;
  announced_for: number | null;
  announced_against: number | null;
  source_id: string;
}

export interface PublicMetric {
  window_kind: string;
  window_start: string;
  window_end: string;
  numerator: number;
  denominator: number;
  value: number;
}

export interface InterestDeclaration {
  id: string;
  type: string;
  modifying: number;
  filed_on: string;
  published_on: string;
  official_status: string;
  document: string;
  url: string | null;
  sections: { section: string; item_count: number; explicitly_none: number }[];
}

export interface CampaignAccount {
  election_id: string;
  candidate_id: string;
  candidate_name: string;
  territory_code: string;
  constituency: string;
  decision_code: string;
  decision_label: string;
  declared_expenses_cents: number | null;
  retained_expenses_cents: number | null;
  declared_revenue_cents: number | null;
  retained_revenue_cents: number | null;
  personal_contribution_cents: number | null;
  donations_cents: number | null;
  party_contribution_cents: number | null;
  in_kind_cents: number | null;
  rfe_fixed_cents: number | null;
  transport_fixed_cents: number | null;
  devolution_cents: number | null;
  published_on: string;
  source_id: string;
}

export interface ExpenseReference {
  id: string;
  institution: string;
  role_kind: string;
  territory_category: string;
  effective_on: string;
  measure: string;
  amount_cents: number;
  unit: string;
  gross_net: string;
  value_kind: string;
  document_locator: string;
  source_id: string;
  provenance: Provenance;
}

async function democracyRows<T>(sql: string, values: (string | number)[] = []): Promise<T[]> {
  return (
    await db()
      .prepare(sql)
      .bind(...values)
      .all<T>()
  ).results;
}

const peopleMethod =
  "Identités et mandats officiels. Naissance, profession, contacts et collaborateurs exclus. Les fonctions gouvernementales proviennent du répertoire parlementaire AN et ne constituent pas une reconstitution exhaustive par décret.";
const voteMethod =
  "Chaque Euro : pour, contre et abstention, divisés par les scrutins publics publiés pendant les mandats exacts. Au Sénat, dénominateur limité aux personnes du registre nominatif de chaque scrutin. Non-votants exclus du numérateur. Délégation conservée ; aucune mesure de présence physique. Sénat depuis le 8 juillet 2024, AN législature 17.";
const campaignMethod =
  "Comptes simplifiés publiés par la CNCCFP, euros convertis exactement en centimes. Bases déclarée et retenue distinctes. RFE et FT : remboursements fixés, paiement non attesté. AR et ARR ont des sens différents. Aucun rapprochement automatique par nom avec les parlementaires.";

export async function getElectedIndex(filters: {
  q: string;
  chamber: string;
  group: string;
  department: string;
  page: number;
}) {
  const clauses = ["active=1"];
  const values: (string | number)[] = [];
  if (filters.q) {
    clauses.push("display_name like ?");
    values.push(`%${filters.q}%`);
  }
  if (["AN", "SENAT", "minister"].includes(filters.chamber)) {
    clauses.push(
      filters.chamber === "minister" ? "role_kind=?" : "chamber=? and role_kind!='minister'",
    );
    values.push(filters.chamber);
  }
  if (filters.group) {
    clauses.push("group_label=?");
    values.push(filters.group);
  }
  if (filters.department) {
    clauses.push("territory_code=?");
    values.push(filters.department);
  }
  const where = clauses.join(" and ");
  const [sources, people, count, chambers, groups, departments, ballots] = await Promise.all([
    democracySources(),
    democracyRows<PublicPerson>(
      `select * from public_people where ${where} order by family_name,given_name limit 50 offset ?`,
      [...values, (filters.page - 1) * 50],
    ),
    democracyRows<{ count: number }>(
      `select count(*) as count from public_people where ${where}`,
      values,
    ),
    democracyRows<{ role_kind: string; count: number }>(
      "select role_kind,count(*) as count from public_people where active=1 group by role_kind",
    ),
    democracyRows<{ label: string }>(
      "select distinct group_label as label from public_people where active=1 and group_label is not null order by label",
    ),
    democracyRows<{ code: string; label: string }>(
      "select distinct territory_code as code,territory_label as label from public_people where active=1 and territory_code is not null order by code",
    ),
    democracyRows<PublicBallot>(
      "select * from public_ballots order by voted_on desc,number desc limit 12",
    ),
  ]);
  return {
    people,
    count: count[0]?.count ?? 0,
    chambers,
    groups,
    departments,
    ballots,
    provenance: sources.provenance(
      [sources.cite("an-members"), sources.cite("an-history"), sources.cite("senat-members")],
      peopleMethod,
      "pipeline/sql/46_public_people.sql",
    ),
    voteProvenance: sources.provenance(
      [sources.cite("an-votes"), sources.cite("senat-votes")],
      voteMethod,
      "pipeline/sql/47_public_votes.sql",
    ),
  };
}

export async function getElectedPerson(id: string) {
  const people = await democracyRows<PublicPerson>("select * from public_people where id=?", [id]);
  const person = people[0];
  if (!person) return null;
  const [sources, mandates, metrics, votes, declarations] = await Promise.all([
    democracySources(),
    democracyRows<PublicMandate>(
      "select m.*,o.label as organ_label from public_mandates m left join public_organs o on o.chamber=m.chamber and o.external_id=m.organ_id where m.person_id=? order by m.starts_on desc",
      [id],
    ),
    democracyRows<PublicMetric>(
      "select * from public_person_metrics where person_id=? order by window_kind",
      [id],
    ),
    democracyRows<PublicBallot & { position: string; delegated: number }>(
      "select b.*,v.position,v.delegated from public_votes v join public_ballots b on b.id=v.ballot_id where v.person_id=? and b.chamber=? order by b.voted_on desc,b.number desc limit 20",
      [id, person.chamber],
    ),
    democracyRows<Omit<InterestDeclaration, "url" | "sections">>(
      "select * from interest_declarations where person_id=? order by published_on desc",
      [id],
    ),
  ]);
  const interests: InterestDeclaration[] = await Promise.all(
    declarations.map(async (declaration) => ({
      ...declaration,
      url: sources.cite("hatvp-interests", { document: declaration.document }).recordUrl,
      sections: await democracyRows<InterestDeclaration["sections"][number]>(
        "select section,item_count,explicitly_none from declared_interests where declaration_id=? order by section",
        [declaration.id],
      ),
    })),
  );
  return {
    person,
    mandates,
    metrics,
    votes,
    interests,
    hatvpUrl: person.hatvp_ref
      ? sources.cite("hatvp-person", { person: person.hatvp_ref }).recordUrl
      : null,
    provenance: sources.provenance(
      [sources.cite(person.source_id)],
      peopleMethod,
      "pipeline/sql/46_public_people.sql",
    ),
    voteProvenance: sources.provenance(
      [sources.cite(person.chamber === "AN" ? "an-votes" : "senat-votes")],
      voteMethod,
      "pipeline/sql/47_public_votes.sql",
    ),
    interestProvenance: sources.provenance(
      [sources.cite("hatvp-interests")],
      "DI, DIM, DIA, DIAM livrées uniquement, identité et rôle corroborés avec l’identifiant officiel. Résumé des rubriques par identité, rôle et date de dépôt uniquement si correspondance unique. Pas de texte libre ni de patrimoine. Les détails restent chez HATVP. Reconstruction complète du corpus courant à chaque import.",
      "pipeline/sql/49_interests.sql",
    ),
  };
}

export async function getPublicBallot(id: string) {
  const ballots = await democracyRows<PublicBallot>("select * from public_ballots where id=?", [
    id,
  ]);
  const ballot = ballots[0];
  if (!ballot) return null;
  const [sources, votes, groups, corrections] = await Promise.all([
    democracySources(),
    democracyRows<{
      person_id: string;
      display_name: string;
      position: string;
      delegated: number;
      source_status: string | null;
      group_label: string | null;
    }>(
      "select v.person_id,coalesce(p.display_name,v.person_id) as display_name,v.position,v.delegated,v.source_status,o.label as group_label from public_votes v left join public_people p on p.id=v.person_id left join public_organs o on o.chamber=? and o.external_id=v.group_id where v.ballot_id=? order by display_name",
      [ballot.chamber, id],
    ),
    democracyRows<{ group_label: string; position: string; count: number }>(
      "select coalesce(o.label,'Groupe non renseigné') as group_label,v.position,count(*) as count from public_votes v left join public_organs o on o.chamber=? and o.external_id=v.group_id where v.ballot_id=? group by group_label,v.position order by group_label,v.position",
      [ballot.chamber, id],
    ),
    democracyRows<{ ordinal: number; person_id: string | null; intended_position: string }>(
      "select * from public_vote_corrections where ballot_id=? order by ordinal",
      [id],
    ),
  ]);
  return {
    ballot,
    votes,
    groups,
    corrections,
    provenance: sources.provenance(
      [sources.cite(ballot.source_id, { number: ballot.number, session: ballot.session })],
      voteMethod + " Les corrections et intentions ne remplacent pas le vote comptabilisé.",
      "pipeline/sql/47_public_votes.sql",
    ),
  };
}

export async function getCampaignIndex(filters: {
  election: string;
  q: string;
  department: string;
  decision: string;
  page: number;
}) {
  const clauses = ["election_id=?"];
  const values: (string | number)[] = [filters.election];
  if (filters.q) {
    clauses.push("(candidate_name like ? or constituency like ?)");
    values.push(`%${filters.q}%`, `%${filters.q}%`);
  }
  if (filters.department) {
    clauses.push("territory_code=?");
    values.push(filters.department);
  }
  if (filters.decision) {
    clauses.push("decision_code=?");
    values.push(filters.decision);
  }
  const where = clauses.join(" and ");
  const [sources, accounts, count, totals, decisions, territories, municipal] = await Promise.all([
    democracySources(),
    democracyRows<CampaignAccount>(
      `select * from campaign_accounts where ${where} order by candidate_name limit 50 offset ?`,
      [...values, (filters.page - 1) * 50],
    ),
    democracyRows<{ count: number }>(
      `select count(*) as count from campaign_accounts where ${where}`,
      values,
    ),
    democracyRows<{
      count: number;
      declared: number | null;
      retained: number | null;
      party: number | null;
    }>(
      "select count(*) as count,sum(declared_expenses_cents) as declared,sum(retained_expenses_cents) as retained,sum(party_contribution_cents) as party from campaign_accounts where election_id=?",
      [filters.election],
    ),
    democracyRows<{ decision_code: string; decision_label: string; count: number }>(
      "select decision_code,decision_label,count(*) as count from campaign_accounts where election_id=? group by decision_code,decision_label order by decision_code",
      [filters.election],
    ),
    democracyRows<{ code: string; label: string }>(
      "select distinct territory_code as code,territory_code as label from campaign_accounts where election_id=? order by code",
      [filters.election],
    ),
    democracyRows<{
      id: string;
      candidate_name: string;
      territory_label: string;
      document: string;
      rectifies_id: string | null;
    }>("select * from campaign_decisions order by candidate_name,id"),
  ]);
  return {
    accounts,
    count: count[0]?.count ?? 0,
    totals: totals[0]!,
    decisions,
    territories,
    municipal: municipal.map((r) => ({
      ...r,
      url: sources.cite("cnccfp-mun2026", { document: r.document }).recordUrl,
    })),
    provenance: sources.provenance(
      [sources.cite(filters.election === "europeennes-2024" ? "cnccfp-eu2024" : "cnccfp-leg2024")],
      campaignMethod,
      "pipeline/sql/48_campaign_accounts.sql",
    ),
    municipalProvenance: sources.provenance(
      [sources.cite("cnccfp-mun2026")],
      "Index des décisions publiées. Contrôle des municipales 2026 encore en cours. Les décisions initiales et rectificatives restent distinctes. Les montants et résultats non extraits sont disponibles dans le PDF officiel.",
      "pipeline/sql/48_campaign_accounts.sql",
    ),
  };
}

export async function getCampaignAccount(election: string, id: string) {
  const rows = await democracyRows<CampaignAccount>(
    "select * from campaign_accounts where election_id=? and candidate_id=?",
    [election, id],
  );
  const account = rows[0];
  if (!account) return null;
  const [sources, lines] = await Promise.all([
    democracySources(),
    democracyRows<{
      basis: string;
      category: string;
      amount_cents: number | null;
      ordinal: number;
    }>(
      "select * from campaign_account_lines where election_id=? and candidate_id=? order by ordinal,basis,category",
      [election, id],
    ),
  ]);
  return {
    account,
    lines,
    provenance: sources.provenance(
      [sources.cite(account.source_id)],
      campaignMethod + ` Ligne source : ${account.candidate_id}.`,
      "pipeline/sql/48_campaign_accounts.sql",
    ),
  };
}

export async function getDemocracyAlerts(filters: {
  rule: string;
  election: string;
  department: string;
  page: number;
}) {
  const clauses = ["1=1"];
  const values: (string | number)[] = [];
  for (const [column, value] of [
    ["rule", filters.rule],
    ["election_id", filters.election],
    ["territory_code", filters.department],
  ]) {
    if (value) {
      clauses.push(`${column}=?`);
      values.push(value);
    }
  }
  const where = clauses.join(" and ");
  const [sources, rows, count, totals] = await Promise.all([
    democracySources(),
    democracyRows<{
      id: string;
      election_id: string;
      candidate_id: string;
      candidate_name: string;
      territory_code: string;
      rule: string;
      official_status: string;
      observed_on: string;
    }>(
      `select * from transparency_alerts where ${where} order by observed_on desc,candidate_name limit 50 offset ?`,
      [...values, (filters.page - 1) * 50],
    ),
    democracyRows<{ count: number }>(
      `select count(*) as count from transparency_alerts where ${where}`,
      values,
    ),
    democracyRows<{ rule: string; count: number }>(
      "select rule,count(*) as count from transparency_alerts group by rule",
    ),
  ]);
  return {
    rows,
    count: count[0]?.count ?? 0,
    totals,
    provenance: sources.provenance(
      [sources.cite("cnccfp-leg2024"), sources.cite("cnccfp-eu2024")],
      "Règles déterministes : codes CNCCFP R, AD, HD uniquement. DD est une dispense. Une réformation, une réduction de remboursement ou un rejet administratif ne prouve pas une infraction, une inéligibilité ou une condamnation. Pas d’alerte HATVP déduite d’une absence de publication. Statut judiciaire non renseigné.",
      "pipeline/sql/48_campaign_accounts.sql",
    ),
  };
}

export async function getPublicExpenses() {
  const [sources, references, cabinets, cada, budget] = await Promise.all([
    democracySources(),
    democracyRows<Omit<ExpenseReference, "provenance">>(
      "select * from expense_reference_values order by institution,role_kind,id",
    ),
    democracyRows<{
      observed_on: string;
      document_year: number;
      category: string;
      value: number;
      unit: string;
    }>("select * from cabinet_statistics order by category"),
    democracyRows<{
      kind: string;
      count: number;
      favorable: number;
      unfavorable: number;
      other: number;
      first: string;
      last: string;
    }>(
      "select kind,count(*) as count,sum(favorable) as favorable,sum(unfavorable) as unfavorable,sum(other) as other,min(session_on) as first,max(session_on) as last from cada_opinions group by kind order by kind",
    ),
    democracyRows<{ year: number; stage: string; amount: number }>(
      "select 2025 as year,'Exécuté' as stage,sum(spent) as amount from budget where mission='Pouvoirs publics' union all select 2026,'Voté',sum(voted) from budget_voted where mission='Pouvoirs publics'",
    ),
  ]);
  return {
    references: references.map((r) => ({
      ...r,
      provenance: sources.provenance(
        [sources.cite(r.source_id)],
        `${r.document_locator}. ${r.value_kind}. Référence datée, pas dépense individuelle constatée.`,
        "pipeline/sql/55_expense_reference_values.sql",
      ),
    })),
    cabinets,
    cada,
    budget,
    cabinetProvenance: sources.provenance(
      [sources.cite("cabinet-staff")],
      "Effectifs agrégés au 1er juillet 2025, annexe PLF 2026. Membres et soutien séparés. Pas de salaire moyen inféré des indemnités pour sujétions particulières.",
      "pipeline/sql/56_public_expenses.sql",
    ),
    cadaProvenance: sources.provenance(
      [sources.cite("cada")],
      "Dossiers Avis et Conseil uniques. Sanctions, texte libre, administrations et requérants exclus. Sens favorable et défavorable peuvent se chevaucher. L’avis ne prouve pas la communication effective du document. La date d’import ne prolonge pas la période des séances.",
      "pipeline/sql/56_public_expenses.sql",
    ),
    budgetProvenance: sources.provenance(
      [sources.cite("plrg-2025"), sources.cite("lfi-2026")],
      "Mission Pouvoirs publics des tables budgétaires existantes : exécution et crédits votés séparés. Ne pas ajouter les indemnités à ces totaux.",
      "pipeline/sql/25_budget.sql",
    ),
    accessProvenance: sources.provenance(
      [
        sources.cite("parliament-access"),
        sources.cite("an-expense"),
        sources.cite("senat-expense"),
      ],
      "Distinguer publication, communicabilité et contrôle interne. Aucun justificatif individuel n’est importé. Les courriers officiels de juin 2026 évoqués ailleurs ne sont pas disponibles dans le corpus vérifié.",
      "pipeline/sql/56_public_expenses.sql",
    ),
  };
}

export async function getElectedRegister(q: string, page: number) {
  const [sources, statistics, executives, count] = await Promise.all([
    democracySources(),
    democracyRows<{
      mandate_kind: string;
      department_code: string;
      sex: string;
      age_band: string;
      records: number;
      data_date: string;
    }>("select * from rne_statistics"),
    democracyRows<{
      id: string;
      display_name: string;
      role_label: string;
      territory_code: string;
      territory_label: string;
      department_code: string;
      starts_on: string;
      data_date: string;
    }>(
      "select * from local_executives where display_name like ? or territory_label like ? order by territory_label,display_name limit 50 offset ?",
      [`%${q}%`, `%${q}%`, (page - 1) * 50],
    ),
    democracyRows<{ count: number }>(
      "select count(*) as count from local_executives where display_name like ? or territory_label like ?",
      [`%${q}%`, `%${q}%`],
    ),
  ]);
  return {
    statistics,
    executives,
    count: count[0]?.count ?? 0,
    provenance: sources.provenance(
      [sources.cite("rne")],
      "Lignes de mandats ou fonctions, jamais personnes uniques. Aucun rapprochement par nom seul. Sexe et âge uniquement agrégés, âge au millésime de chaque fichier. Les dates de naissance et professions ne sont pas exportées. AFE et consulaires : mai 2026 ; autres catégories : août 2026.",
      "pipeline/sql/46_public_people.sql",
    ),
  };
}

export async function getLocalExecutive(id: string) {
  const [rows, sources] = await Promise.all([
    democracyRows<{
      id: string;
      display_name: string;
      role_label: string;
      territory_code: string;
      territory_label: string;
      department_code: string;
      starts_on: string;
      data_date: string;
    }>("select * from local_executives where id=?", [id]),
    democracySources(),
  ]);
  if (!rows[0]) return null;
  return {
    executive: rows[0],
    provenance: sources.provenance(
      [sources.cite("rne")],
      "Identité dans la fonction de maire, territoire et date du RNE. Identifiant de ligne dérivé du rôle public, sans naissance. Pas de rapprochement automatique avec d’autres personnes. Aucun montant de barème attribué comme indemnité réellement perçue.",
      "pipeline/sql/46_public_people.sql",
    ),
  };
}

export async function getPublicBallots(params: URLSearchParams) {
  const chamber = params.get("chambre") ?? "";
  const query = (params.get("q") ?? "").trim();
  const page = pageNumber(params.get("page"));
  const where = "where (?='' or chamber=?) and (?='' or title like ? or cast(number as text)=?)";
  const values = [chamber, chamber, query, `%${query}%`, query];
  const [sources, count, ballots] = await Promise.all([
    democracySources(),
    democracyRows<{ count: number }>(
      `select count(*) as count from public_ballots ${where}`,
      values,
    ),
    democracyRows<PublicBallot>(
      `select * from public_ballots ${where} order by voted_on desc,number desc limit 50 offset ?`,
      [...values, (page - 1) * 50],
    ),
  ]);
  return {
    chamber,
    query,
    page,
    count: count[0]?.count ?? 0,
    ballots,
    provenance: sources.provenance(
      [sources.cite("an-votes"), sources.cite("senat-votes")],
      voteMethod,
      "pipeline/sql/47_public_votes.sql",
    ),
  };
}

export interface CommuneChoice {
  insee: string;
  name: string;
  department: string;
  departmentName: string;
}

export async function getAddressLookup() {
  const sources = await democracySources();
  return {
    endpoint: sources.get("ban-geocoding").recordUrl,
    provenance: sources.provenance(
      [sources.cite("ban-geocoding"), sources.cite("insee-constituency-contours")],
      "Géocodage BAN confirmé par le visiteur, puis calcul dans son navigateur. Contours officiels Insee simplifiés : résultat indicatif, jamais une preuve de rattachement électoral. Aucun résultat à moins de 200 mètres d’une limite ; ce seuil de prudence ne garantit pas la précision des contours. Communes non partagées : table de correspondance Insee, sans polygones.",
      "pipeline/sql/59_constituency_shapes.sql",
    ),
  };
}

export async function getAddressConstituencies(insee: string) {
  const [local, lookup] = await Promise.all([getCommuneRepresentatives(insee), getAddressLookup()]);
  const split = new Set(local.deputies.map((deputy) => deputy.constituency)).size > 1;
  const shapes = split
    ? await democracyRows<{ constituency: number; geometry: string }>(
        "select constituency,geometry from constituency_shapes where insee=? order by constituency",
        [insee],
      )
    : [];
  return {
    commune: local.commune,
    deputies: local.deputies,
    shapes: shapes.map((shape) => ({
      constituency: shape.constituency,
      geometry: JSON.parse(shape.geometry) as ConstituencyGeometry,
    })),
    provenance: {
      ...lookup.provenance,
      citations: [...local.provenance.citations, ...lookup.provenance.citations],
    },
  };
}

export async function getCommuneRepresentatives(query: string) {
  const match = ftsQuery(query);
  const communes = !match
    ? []
    : await democracyRows<CommuneChoice>(
        /^[0-9][0-9AB][0-9]{3}$/i.test(query.trim())
          ? "select insee,name,department_code as department,department_name as departmentName from communes where insee=?"
          : `select c.insee,c.name,c.department_code as department,c.department_name as departmentName
             from search join communes c on c.insee=search.ref
             where search match ? and search.kind='Commune' order by search.weight desc limit 20`,
        [/^[0-9][0-9AB][0-9]{3}$/i.test(query.trim()) ? query.trim().toUpperCase() : match],
      );
  const exact = communes.filter((c) => normalizeSearch(c.name) === normalizeSearch(query));
  const commune = exact.length === 1 ? exact[0] : communes.length === 1 ? communes[0] : null;
  const sources = await democracySources();
  const deputies = commune
    ? await democracyRows<{
        constituency: number;
        id: string | null;
        name: string | null;
        group: string | null;
      }>(
        `select c.constituency,p.id,p.display_name as name,p.group_label as "group"
         from commune_constituencies c left join (
           select m.person_id,r.department_code,r.constituency
           from mandate_constituencies r join public_mandates m on m.id=r.mandate_id
           where m.kind='ASSEMBLEE' and m.starts_on<=date('now')
             and (m.ends_on is null or m.ends_on>=date('now'))
         ) m on m.department_code=c.department_code and m.constituency=c.constituency
         left join public_people p on p.id=m.person_id and p.active=1
         where c.insee=? order by c.constituency,p.display_name`,
        [commune.insee],
      )
    : [];
  const senators = commune
    ? await democracyRows<PublicPerson>(
        "select * from public_people where chamber='SENAT' and active=1 and territory_code=? order by family_name,given_name",
        [commune.department],
      )
    : [];
  return {
    communes,
    commune,
    deputies,
    senators,
    provenance: sources.provenance(
      [
        sources.cite("commune-circonscriptions-2024"),
        sources.cite("insee-passage-2025"),
        sources.cite("an-members"),
        sources.cite("an-history"),
        sources.cite("senat-members"),
      ],
      "Table officielle INSEE des communes et circonscriptions du découpage en vigueur en 2024, codes communaux 2021 rapprochés avec le COG 2025. Toutes les circonscriptions d’une commune partagée sont conservées. Députés de la XVIIe législature : circonscription du mandat AN, dates du mandat et statut actif dans le dernier répertoire importé. Sénateurs actifs du département. Une scission ambiguë reste non disponible.",
      "pipeline/sql/57_commune_constituencies.sql",
    ),
  };
}

export async function getCommuneFunctions(insee: string, year: number) {
  const [rows, years, sources] = await Promise.all([
    democracyRows<
      Omit<FinanceLine, "amount"> & { amount: number | null; peers: number; nomenclature: string }
    >(
      `with budget as (
         select distinct nomenclature,section from commune_functions where insee=?1 and year=?2
       ), labels as (
         select l.*,b.section from commune_function_labels l join budget b using(nomenclature)
         union all select nomenclature,'unallocated','Sans ventilation par service',999,section from budget
       )
       select l.function_code as item,l.label,l.section,l.nomenclature,
         f.amount,f.per_capita as perCapita,
         s.median_per_capita as median,
         coalesce(s.communes,0) as peers
       from labels l left join commune_functions f on f.insee=?1 and f.year=?2
         and f.nomenclature=l.nomenclature and f.section=l.section and f.function_code=l.function_code
       left join commune_years y on y.insee=f.insee and y.year=f.year
       left join commune_function_strata s on s.stratum=y.stratum and s.year=f.year
         and s.nomenclature=f.nomenclature and s.section=f.section and s.function_code=f.function_code
       order by l.section,l.sort`,
      [insee, year],
    ),
    democracyRows<{ year: number }>(
      "select distinct year from commune_functions where insee=? order by year desc",
      [insee],
    ),
    democracySources(),
  ]);
  return {
    year,
    insee,
    years: years.map((row) => row.year),
    lines: rows.flatMap((r) => (r.amount === null ? [] : [{ ...r, amount: r.amount }])),
    unavailable: [...new Set(rows.filter((r) => r.amount === null).map((r) => r.label))],
    provenance: sources.provenance(
      [
        sources.cite(`dgfip-fonctions-${year === 2024 ? 2024 : 2025}`),
        sources.cite("cgct-fonctions-2025"),
        sources.cite("ofgl-communes", { insee, year }),
        sources.cite("dgfip-fonctions-notice"),
        sources.cite("dgcl-nomenclatures"),
      ],
      "Budget principal uniquement. Opérations budgétaires au débit nettes des annulations, opérations d’ordre comprises. Fonctionnement : classe 6. Investissement en équipements et immobilisations : comptes 20 à 23, subventions d’équipement comprises. Hors remboursements de dette, actifs financiers, opérations pour compte de tiers et budgets annexes. Ces immobilisations ne représentent pas toute la section d’investissement. En M57 votée par fonction, les préfixes de chapitre 90 et 93 sont retirés ; les autres chapitres spéciaux restent sans ventilation par service. Regroupement au plus long préfixe M14 ou M57. Division par la population OFGL de la même année. Médiane sur les communes publiant le service, de même strate, année, section et nomenclature, à partir de cinq communes. Paris comprend aussi les dépenses départementales : son périmètre diffère de celui des autres communes. Les absences ne sont pas remplacées par zéro.",
      "pipeline/sql/58_commune_functions.sql",
    ),
  };
}

export const SITEMAP_SIZE = 50000;
const SITEMAP_SECTIONS = new Map([
  ["organisations", "select '/organisation/' || siren as path from orgs order by siren"],
  ["communes", "select '/commune/' || insee as path from communes order by insee"],
  ["departements", "select '/departement/' || code as path from departements order by code"],
  ["administrations", "select '/administrations/' || id as path from administrations order by id"],
  [
    "campagnes",
    "select '/campagnes/' || election_id || '/' || candidate_id as path from campaign_accounts order by election_id, candidate_id",
  ],
  ["dossiers", "select '/documents/dossiers/' || id as path from legislative_files order by id"],
  ["elus", "select '/elus/' || id as path from public_people order by id"],
  ["elus-locaux", "select '/elus/locaux/' || id as path from local_executives order by id"],
  ["votes", "select '/votes/' || id as path from public_ballots order by id"],
]);

export async function getSitemapFiles(): Promise<string[]> {
  const counts = await db().batch<{ count: number }>(
    [...SITEMAP_SECTIONS.values()].map((sql) =>
      db().prepare(`select count(*) as count from (${sql})`),
    ),
  );
  return [...SITEMAP_SECTIONS.keys()].flatMap((name, index) =>
    Array.from(
      { length: Math.ceil((counts[index]?.results[0]?.count ?? 0) / SITEMAP_SIZE) },
      (_, file) => `${name}-${file + 1}`,
    ),
  );
}

export async function getSitemapPaths(name: string, file: number): Promise<string[]> {
  const sql = SITEMAP_SECTIONS.get(name);
  if (!sql || !Number.isInteger(file) || file < 1) return [];
  const { results } = await db()
    .prepare(`${sql} limit ?1 offset ?2`)
    .bind(SITEMAP_SIZE, (file - 1) * SITEMAP_SIZE)
    .all<{ path: string }>();
  return results.map((row) => row.path);
}
