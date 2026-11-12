import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ANALYSES, analysis } from "./analyses";
import { addressConstituency, communeCode } from "./constituencies";
import {
  getAddressConstituencies,
  getAdministration,
  getAdministrations,
  getBudgetLegislation,
  getCampaignAccount,
  getCampaignIndex,
  getCommune,
  getCommuneDgfHistory,
  getCommuneFunctions,
  getCommuneLocal,
  getCommuneRepresentatives,
  getCommunesIndex,
  getDeficitAnalysis,
  getDemocracyAlerts,
  getDepartement,
  getDepartmentLocal,
  getDownloads,
  getElectedIndex,
  getElectedPerson,
  getElectedRegister,
  getEuropeAnalysis,
  getHome,
  getLegislativeFile,
  getLegislativeFiles,
  getLobbying,
  getLocalAccounts,
  getLocalExecutive,
  getManifest,
  getOfficialJournal,
  getOrganisation,
  getOrganisationGroup,
  getOrganisationLobbying,
  getOrganisationsIndex,
  getParisAnalysis,
  getPoliticalFinance,
  getProcurement,
  getProcurementCompetition,
  getProcurementOpportunities,
  getPublicBallot,
  getPublicBallots,
  getPublicExpenses,
  getPublicFamily,
  getPublicIndicators,
  getPublicMoney,
  getRailAnalysis,
  getSocialAccounts,
  getSocialProtection,
  getStateBudget,
  getStateExecution,
  getStudentAnalysis,
  search,
} from "./data";
import { registerLabels } from "./democracy";
import { PUBLIC_FUNCTIONS, PUBLIC_MEMBERS, PUBLIC_SECTORS } from "./flows";
import { GLOSSARY, GLOSSARY_THEMES } from "./glossary";
import { PUBLIC_ORIGIN } from "./site";
import { normalizeSearch } from "./topics";

const INSTRUCTIONS = `Chaque Euro (${PUBLIC_ORIGIN}) publishes French public-money data fetched from the official publishers: State budget, public accounts, communes and local authorities, organisations and public procurement, lobbying, political finance, elected officials, votes, Journal officiel and legislation. Each tool mirrors a page of the site and returns its url.
Always give figures with their source links (provenance.citations: source page, file or record URL) and their data date (source.dataDate), and link the Chaque Euro page. Report figures as published: never infer favouritism, fraud or wrongdoing from them. Natural persons other than public officials are never named. Answer in the user's language.
Amounts are in euros, except fields ending in _cents. Paths such as /commune/69123 are relative to ${PUBLIC_ORIGIN}.`;

const annotations = { readOnlyHint: true, openWorldHint: false, idempotentHint: true };
const PAGE_SIZE = 50;

const text = z.string().trim().max(100);
const page = z.number().int().min(1).max(100000).optional().describe("Page number, from 1");
const department = text.describe("Département code as published, e.g. 01, 2A, 971");
const id = z.string().trim().min(1).max(100);
const siren = z
  .string()
  .regex(/^\d{9}$/)
  .describe("SIREN, 9 digits");
const insee = z
  .string()
  .regex(/^[0-9][0-9AB][0-9]{3}$/)
  .describe("INSEE commune code, 5 characters, e.g. 69123 or 2A004");
const election = z.enum(["legislatives-2024", "europeennes-2024"]);

const ANALYSIS_DATA = {
  "deficit-par-president": getDeficitAnalysis,
  europe: getEuropeAnalysis,
  paris: getParisAnalysis,
  rail: getRailAnalysis,
  etudiants: getStudentAnalysis,
};

type Query = Record<string, string | number | undefined>;

function searchParams(query: Query): URLSearchParams {
  return new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) =>
      value === undefined || value === "" ? [] : [[key, String(value)]],
    ),
  );
}

const MAP_DRAWING = new Set([
  "path",
  "geometry",
  "viewBox",
  "franceViewBox",
  "labelX",
  "labelY",
  "labelSize",
  "cx",
  "cy",
]);

function reply(path: string, data: object, query: Query | URLSearchParams = {}): CallToolResult {
  const url = new URL(path, PUBLIC_ORIGIN);
  url.search = (query instanceof URLSearchParams ? query : searchParams(query)).toString();
  const json = JSON.stringify({ url: url.href, ...data }, (key, value: unknown) =>
    MAP_DRAWING.has(key) ? undefined : value,
  );
  return {
    structuredContent: JSON.parse(json) as Record<string, unknown>,
    content: [{ type: "text", text: json }],
  };
}

function pageOf<T>(rows: T[], page = 1): T[] {
  return rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}

function missing(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: "Chaque Euro", version: "1.0.0" },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "search",
    {
      description:
        "Search by name across organisations (companies, associations, public bodies), communes, elected officials, administrations and site topics. Each result has a site path whose last segment is the id for the detail tools (/organisation/<SIREN>, /commune/<INSEE>, /elus/<id>, /administrations/<id>).",
      inputSchema: { query: z.string().trim().min(2).max(200) },
      annotations,
    },
    async ({ query }) => reply("/recherche", { query, results: await search(query) }, { q: query }),
  );

  server.registerTool(
    "get_overview",
    {
      description:
        "Home page headline figures: national key facts with their period, public contracts per year and median commune spending per inhabitant by population band. The State budget and the largest recipients are in get_state_budget and list_organisations.",
      annotations,
    },
    async () => reply("/", await getHome()),
  );

  server.registerTool(
    "list_organisations",
    {
      description:
        "Largest public contract winners (companies), largest recipients of State payments (associations) and largest public buyers, with national totals.",
      annotations,
    },
    async () => reply("/organisations", await getOrganisationsIndex()),
  );

  server.registerTool(
    "get_organisation",
    {
      description:
        "One organisation by SIREN: identity, public contracts won and awarded since 2019 (yearly totals, main counterparts, largest and latest contracts), State payments, documented corporate group, lobbying declarations (HATVP and EU register), competition on its tenders and its upcoming tenders.",
      inputSchema: { siren },
      annotations,
    },
    async ({ siren }) => {
      const organisation = await getOrganisation(siren);
      if (!organisation) return missing(`No organisation with SIREN ${siren}.`);
      const [group, lobbying, competition, opportunities] = await Promise.all([
        getOrganisationGroup(siren),
        getOrganisationLobbying(siren),
        getProcurementCompetition(siren),
        getProcurementOpportunities(siren),
      ]);
      return reply(`/organisation/${siren}`, {
        organisation,
        group,
        lobbying,
        competition,
        opportunities,
      });
    },
  );

  server.registerTool(
    "list_communes",
    {
      description:
        "Communes overview: number of communes, largest communes with spending per inhabitant, median spending per inhabitant by population band, spending per inhabitant of each département's communes, and the national DGF grant history in commune accounts.",
      annotations,
    },
    async () => {
      const [index, dgfHistory] = await Promise.all([getCommunesIndex(), getCommuneDgfHistory()]);
      return reply("/communes", { ...index, dgfHistory });
    },
  );

  server.registerTool(
    "get_commune",
    {
      description:
        "One commune by INSEE code: accounts per inhabitant against the median of communes of the same size, yearly history since 2018, spending by service, local tax rates, income tax, electoral turnout, DGF, public contracts as buyer, and its deputies and senators. `year` selects the accounts year; an unpublished year falls back to the latest.",
      inputSchema: { insee, year: z.number().int().min(2000).max(2100).optional() },
      annotations,
    },
    async ({ insee, year }) => {
      const commune = await getCommune(insee, year);
      if (!commune) return missing(`No commune with INSEE code ${insee}.`);
      const [local, functions, representatives] = await Promise.all([
        getCommuneLocal(insee),
        getCommuneFunctions(insee, commune.accounts.year),
        getCommuneRepresentatives(insee),
      ]);
      return reply(
        `/commune/${insee}`,
        { commune, local, functions, representatives },
        { annee: year },
      );
    },
  );

  server.registerTool(
    "get_departement",
    {
      description:
        "One département by code (01 to 95, 2A, 2B, 971 to 976): spending per inhabitant of each commune against the median of communes of the same size, accounts of the département council and its region over time, and electoral turnout.",
      inputSchema: {
        code: z
          .string()
          .regex(/^(\d{2}|2[AB]|97[1-6])$/)
          .describe("Département code"),
      },
      annotations,
    },
    async ({ code }) => {
      const departement = await getDepartement(code);
      if (!departement) return missing(`No département with code ${code}.`);
      return reply(`/departement/${code}`, {
        departement,
        local: await getDepartmentLocal(code),
      });
    },
  );

  server.registerTool(
    "list_local_authorities",
    {
      description:
        "Accounts of regions (level region) or intercommunalités (level epci) for one year: spending, revenue and debt, also per inhabitant, 50 per page, filterable by name or SIREN, with the 8 highest spenders per inhabitant among matches.",
      inputSchema: {
        level: z.enum(["region", "epci"]),
        year: z.number().int().min(2018).max(2025).optional().describe("Defaults to 2025"),
        query: text.optional().describe("Name or SIREN"),
        page,
      },
      annotations,
    },
    async ({ level, year, query = "", page }) => {
      const data = await getLocalAccounts(level, year ?? 2025, query, page ?? 1);
      return reply(
        level === "region" ? "/regions" : "/intercommunalites",
        {
          ...data,
          accounts: data.accounts.map(({ provenance, ...account }) => ({
            ...account,
            recordUrl: provenance.citations[0]?.recordUrl,
          })),
        },
        { annee: year, q: query, page },
      );
    },
  );

  server.registerTool(
    "get_state_budget",
    {
      description:
        "State budget: spending executed by mission and programme, revenue by tax, budget voted for next year, public finances by sub-sector since 1949, monthly execution, spending by type and ministry, State balance sheet, green budget and the related finance laws.",
      annotations,
    },
    async () => {
      const [budget, execution, legislation] = await Promise.all([
        getStateBudget(),
        getStateExecution(),
        getBudgetLegislation("État"),
      ]);
      return reply("/budget-etat", { budget, execution, legislation });
    },
  );

  server.registerTool(
    "get_public_money",
    {
      description:
        "All French public money (State, State operators, local authorities, social security) by sector and by function, compulsory levies, European comparisons and quarterly debt. Pass `family` for one family's detailed accounts; securite-sociale adds the social security branches, ONDAM, health payers, pensions, family benefits and unemployment insurance.",
      inputSchema: { family: z.enum(PUBLIC_SECTORS.map((sector) => sector.slug)).optional() },
      annotations,
    },
    async ({ family }) => {
      const sector = PUBLIC_SECTORS.find((entry) => entry.slug === family);
      if (!sector) {
        const [money, indicators] = await Promise.all([getPublicMoney(), getPublicIndicators()]);
        return reply("/argent-public", {
          money,
          indicators,
          sectors: PUBLIC_SECTORS,
          functionLabels: PUBLIC_FUNCTIONS,
        });
      }
      const social = sector.code === "S1314";
      const [accounts, protection, socialAccounts, legislation] = await Promise.all([
        getPublicFamily(sector.code),
        social ? getSocialProtection() : null,
        social ? getSocialAccounts() : null,
        social ? getBudgetLegislation("Sécurité sociale") : null,
      ]);
      return reply(`/argent-public/${sector.slug}`, {
        sector,
        family: accounts,
        protection,
        socialAccounts,
        legislation,
        functionLabels: PUBLIC_FUNCTIONS,
        memberLabels: PUBLIC_MEMBERS,
      });
    },
  );

  server.registerTool(
    "get_analysis",
    {
      description:
        "Thematic analyses. Without `slug`, lists them. With a slug, returns that analysis's data series and sources: public deficit and debt by presidency, France and the EU budget, Paris spending, rail funding, student support.",
      inputSchema: {
        slug: z.enum(Object.keys(ANALYSIS_DATA) as (keyof typeof ANALYSIS_DATA)[]).optional(),
      },
      annotations,
    },
    async ({ slug }) =>
      slug
        ? reply(`/analyses/${slug}`, {
            analysis: analysis(slug),
            data: await ANALYSIS_DATA[slug](),
          })
        : reply("/analyses", { analyses: ANALYSES }),
  );

  server.registerTool(
    "get_procurement",
    {
      description:
        "Public procurement overview: contracts by month, buyer département, procedure and type, publication quality, latest contracts, largest buyers and winners, single-bid rates, upcoming tenders and Competition Authority sanctions.",
      annotations,
    },
    async () => {
      const [procurement, opportunities, competition] = await Promise.all([
        getProcurement(),
        getProcurementOpportunities(),
        getProcurementCompetition(),
      ]);
      return reply("/marches-publics", { procurement, opportunities, competition });
    },
  );

  server.registerTool(
    "get_lobbying",
    {
      description:
        "Lobbying registers (HATVP for France, EU Transparency Register): totals, organisations with the most declared activities, targeted institutions and ministries, declared budgets, declaration defaults and links with public contracts and State payments. `organisation` filters lists by name.",
      inputSchema: { organisation: text.optional() },
      annotations,
    },
    async ({ organisation = "" }) =>
      reply("/lobbying", await getLobbying(organisation), { organisation }),
  );

  server.registerTool(
    "get_political_finance",
    {
      description:
        "Political party accounts (CNCCFP): 2024 resources, donations and public aid of every party (50 per page, largest first), total public aid per year since 2021, the selected party's history and parties deprived of public aid. `party` is a CNCCFP party code from the accounts list; it selects the party detailed on the page.",
      inputSchema: { party: text.optional(), page },
      annotations,
    },
    async ({ party, page }) => {
      const data = await getPoliticalFinance(party ?? null);
      if (party && data.selected.code !== party) return missing(`No party with code ${party}.`);
      return reply(
        "/financement-politique",
        { ...data, accounts: pageOf(data.accounts, page), accountCount: data.accounts.length },
        { parti: party },
      );
    },
  );

  server.registerTool(
    "list_campaign_accounts",
    {
      description:
        "Candidates' campaign accounts for the 2024 legislative or European elections (CNCCFP), 50 per page, with totals, counts by decision code and the index of 2026 municipal decisions (filtered by `query`, same page). Filter by candidate or constituency name, département code or decision code. Amounts are in cents.",
      inputSchema: {
        election: election.optional().describe("Defaults to legislatives-2024"),
        query: text.optional(),
        departement: department.optional(),
        decision: text.optional().describe("CNCCFP decision code, e.g. A, AR, R"),
        page,
      },
      annotations,
    },
    async ({ election, query = "", departement = "", decision = "", page }) => {
      const index = await getCampaignIndex({
        election: election ?? "legislatives-2024",
        q: query,
        department: departement,
        decision,
        page: page ?? 1,
      });
      const needle = normalizeSearch(query);
      const municipal = index.municipal.filter((row) =>
        normalizeSearch(`${row.candidate_name} ${row.territory_label}`).includes(needle),
      );
      return reply(
        "/campagnes",
        { ...index, municipal: pageOf(municipal, page), municipalCount: municipal.length },
        { election, q: query, departement, decision, page },
      );
    },
  );

  server.registerTool(
    "get_campaign_account",
    {
      description:
        "One candidate's campaign account (CNCCFP) with every line. `id` is the candidate_id from list_campaign_accounts. Amounts are in cents.",
      inputSchema: { election, id },
      annotations,
    },
    async ({ election, id }) => {
      const data = await getCampaignAccount(election, id);
      if (!data) return missing(`No ${election} campaign account with id ${id}.`);
      return reply(`/campagnes/${election}/${encodeURIComponent(id)}`, data);
    },
  );

  server.registerTool(
    "list_alerts",
    {
      description:
        "Campaign account alerts from CNCCFP decisions: rejected accounts, accounts not filed and accounts filed late, newest first, 50 per page. They are official decisions, not proof of an offence.",
      inputSchema: {
        rule: z.enum(["rejected-account", "not-filed", "late-filed"]).optional(),
        election: election.optional(),
        departement: department.optional(),
        page,
      },
      annotations,
    },
    async ({ rule = "", election = "", departement = "", page }) =>
      reply(
        "/alertes",
        await getDemocracyAlerts({ rule, election, department: departement, page: page ?? 1 }),
        { regle: rule, election, departement, page },
      ),
  );

  server.registerTool(
    "list_elected",
    {
      description:
        "Current deputies, senators and members of the government, 50 per page, filterable by name, chamber, parliamentary group and département code, with counts per chamber and the latest public votes.",
      inputSchema: {
        query: text.optional(),
        chamber: z.enum(["AN", "SENAT", "minister"]).optional(),
        group: text.optional().describe("Parliamentary group label as published"),
        departement: department.optional(),
        page,
      },
      annotations,
    },
    async ({ query = "", chamber = "", group = "", departement = "", page }) =>
      reply(
        "/elus",
        await getElectedIndex({
          q: query,
          chamber,
          group,
          department: departement,
          page: page ?? 1,
        }),
        { q: query, chambre: chamber, groupe: group, departement, page },
      ),
  );

  server.registerTool(
    "find_representatives",
    {
      description:
        "Deputies and senators of a commune given by name or INSEE code. An ambiguous name returns candidate communes. For a commune split between several constituencies, pass the address longitude and latitude (WGS84) to get its single deputy, as the site's address finder does; none is given within 200 m of a boundary.",
      inputSchema: {
        commune: z.string().trim().min(2).max(100).describe("Commune name or INSEE code"),
        longitude: z.number().min(-180).max(180).optional(),
        latitude: z.number().min(-90).max(90).optional(),
      },
      annotations,
    },
    async ({ commune, longitude, latitude }) => {
      const local = await getCommuneRepresentatives(communeCode(commune));
      if (!local.communes.length) return missing(`No commune matches ${commune}.`);
      if (!local.commune || longitude === undefined || latitude === undefined) {
        return reply("/elus#trouver", local, { commune });
      }
      const { deputies, shapes, provenance } = await getAddressConstituencies(local.commune.insee);
      const constituency = addressConstituency([longitude, latitude], deputies, shapes);
      return reply(
        "/elus#trouver",
        {
          ...local,
          address: {
            constituency,
            deputies: deputies.filter((deputy) => deputy.constituency === constituency),
            provenance,
          },
        },
        { commune },
      );
    },
  );

  server.registerTool(
    "get_elected_person",
    {
      description:
        "One deputy, senator or member of the government by id (e.g. PA841605, from search or list_elected): mandates, voting participation, latest votes and summary of HATVP declarations of interests.",
      inputSchema: { id },
      annotations,
    },
    async ({ id }) => {
      const data = await getElectedPerson(id);
      if (!data) return missing(`No elected official with id ${id}.`);
      return reply(`/elus/${encodeURIComponent(id)}`, data);
    },
  );

  server.registerTool(
    "list_local_executives",
    {
      description:
        "National register of elected officials (RNE): counts of mandate rows by kind, sex, age band and département, optionally for one département, and mayors searchable by name or commune, 50 per page.",
      inputSchema: { query: text.optional(), departement: department.optional(), page },
      annotations,
    },
    async ({ query = "", departement = "", page }) =>
      reply(
        "/elus/registre",
        {
          ...(await getElectedRegister(query, page ?? 1, departement)),
          mandateLabels: registerLabels,
        },
        { q: query, departement, page },
      ),
  );

  server.registerTool(
    "get_local_executive",
    {
      description:
        "One mayor from the national register of elected officials, by id (from list_local_executives).",
      inputSchema: { id },
      annotations,
    },
    async ({ id }) => {
      const data = await getLocalExecutive(id);
      if (!data) return missing(`No local executive with id ${id}.`);
      return reply(`/elus/locaux/${encodeURIComponent(id)}`, data);
    },
  );

  server.registerTool(
    "list_votes",
    {
      description:
        "Public votes of the Assemblée nationale and the Sénat, newest first, 50 per page, filterable by chamber and by title words or vote number.",
      inputSchema: { chamber: z.enum(["AN", "SENAT"]).optional(), query: text.optional(), page },
      annotations,
    },
    async ({ chamber, query, page }) => {
      const params = searchParams({ chambre: chamber, q: query, page });
      return reply("/votes", await getPublicBallots(params), params);
    },
  );

  server.registerTool(
    "get_vote",
    {
      description:
        "One public vote by id (e.g. VTANR5L17V9469 or SEN2026-46, from list_votes): result, every member's position, counts by group and vote corrections.",
      inputSchema: { id },
      annotations,
    },
    async ({ id }) => {
      const data = await getPublicBallot(id);
      if (!data) return missing(`No vote with id ${id}.`);
      return reply(`/votes/${encodeURIComponent(id)}`, data);
    },
  );

  server.registerTool(
    "get_official_journal",
    {
      description:
        "Latest editions of the Journal officiel: published texts, 40 per page, filterable by date, nature, ministry and appointment class, with counts by nature, ministry and day and the number of appointments.",
      inputSchema: {
        date: z.iso.date().optional().describe("Publication date, YYYY-MM-DD"),
        nature: text.optional().describe("e.g. DECRET, ARRETE"),
        ministry: z.string().trim().max(300).optional().describe("Ministry label as published"),
        appointmentClass: text.optional().describe("e.g. nomination, cessation"),
        page,
      },
      annotations,
    },
    async ({ date, nature, ministry, appointmentClass, page }) => {
      const params = searchParams({
        date,
        nature,
        ministere: ministry,
        classe: appointmentClass,
        page,
      });
      return reply("/journal-officiel", await getOfficialJournal(params), params);
    },
  );

  server.registerTool(
    "list_legislative_files",
    {
      description:
        "Legislative files from DILA (DOLE), the Assemblée nationale and the Sénat, 40 per page, filterable by title words, source, status, legislature and finance laws.",
      inputSchema: {
        query: text.optional(),
        source: z.enum(["dole", "an-dossiers", "senat-dosleg"]).optional(),
        status: text.optional().describe("e.g. Promulgué, En discussion"),
        legislature: text.optional().describe("e.g. 17"),
        financeLaws: z.boolean().optional(),
        page,
      },
      annotations,
    },
    async ({ query, source, status, legislature, financeLaws, page }) => {
      const params = searchParams({
        q: query,
        source,
        statut: status,
        legislature,
        finances: financeLaws ? 1 : undefined,
        page,
      });
      return reply("/documents/dossiers", await getLegislativeFiles(params), params);
    },
  );

  server.registerTool(
    "get_legislative_file",
    {
      description:
        "One legislative file by id (e.g. an-DLR5L17N53329, from list_legislative_files): steps, documents and the same law's files at other publishers.",
      inputSchema: { id },
      annotations,
    },
    async ({ id }) => {
      const data = await getLegislativeFile(id);
      if (!data) return missing(`No legislative file with id ${id}.`);
      return reply(`/documents/dossiers/${encodeURIComponent(id)}`, data);
    },
  );

  server.registerTool(
    "list_administrations",
    {
      description:
        "Directory of State administrations (ROAE and DILA directory), 40 per page, filterable by name, by category, or to bodies headed by a member of the government.",
      inputSchema: {
        query: text.optional(),
        category: text.optional().describe("e.g. Ministère, Direction"),
        government: z.boolean().optional(),
        page,
      },
      annotations,
    },
    async ({ query, category, government, page }) => {
      const params = searchParams({
        q: query,
        categorie: category,
        gouvernement: government ? 1 : undefined,
        page,
      });
      return reply("/administrations", await getAdministrations(params), params);
    },
  );

  server.registerTool(
    "get_administration",
    {
      description:
        "One administration by id (a UUID, from list_administrations or search): parent and child bodies and communes covered.",
      inputSchema: { id },
      annotations,
    },
    async ({ id }) => {
      const data = await getAdministration(id);
      if (!data) return missing(`No administration with id ${id}.`);
      return reply(`/administrations/${encodeURIComponent(id)}`, data);
    },
  );

  server.registerTool(
    "get_public_expenses",
    {
      description:
        "Means of public office: reference allowances of parliamentarians, members of the government and local officials, ministerial cabinet staff, CADA opinions on access to documents, and the Pouvoirs publics budget.",
      annotations,
    },
    async () => reply("/train-de-vie", await getPublicExpenses()),
  );

  server.registerTool(
    "get_glossary",
    {
      description:
        "Definitions of the terms the site uses (marché public, strate, médiane, épargne brute...), grouped by theme.",
      annotations,
    },
    async () => reply("/lexique", { themes: GLOSSARY_THEMES, terms: GLOSSARY }),
  );

  server.registerTool(
    "get_methodology",
    {
      description:
        "Every source the site uses: publisher, licence, data date, freshness, coverage, rows, SHA-256, known limits, the first URL fetched and how many (every URL is in `allUrls`), plus the social protection total quoted on the methodology page. `source` filters by source name, publisher or id.",
      inputSchema: { source: text.optional() },
      annotations,
    },
    async ({ source = "" }) => {
      const [manifest, socialProtection] = await Promise.all([
        getManifest(),
        getSocialProtection(),
      ]);
      const needle = normalizeSearch(source);
      return reply("/methodologie", {
        manifest: {
          ...manifest,
          sources: manifest.sources
            .filter((entry) =>
              normalizeSearch(
                `${entry.id} ${entry.shortName} ${entry.name} ${entry.publisher}`,
              ).includes(needle),
            )
            .map(({ urls, ...entry }) => ({
              ...entry,
              urls: urls.slice(0, 1),
              urlCount: urls.length,
            })),
          allUrls: new URL("/methodologie/manifest.json", PUBLIC_ORIGIN).href,
        },
        socialProtection,
      });
    },
  );

  server.registerTool(
    "list_downloads",
    {
      description: `Derived data tables published under Licence Ouverte 2.0, with formats, sizes and SHA-256. Each file is at ${PUBLIC_ORIGIN}/telechargements/fichiers/<file>.`,
      annotations,
    },
    async () => reply("/telechargements", await getDownloads()),
  );

  return server;
}
