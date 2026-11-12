import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ANALYSES, analysis } from "./analyses";
import { compact } from "./compact";
import { addressConstituency, communeCode } from "./constituencies";
import {
  getAddressConstituencies,
  getAddressLookup,
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
Always give figures with their source links and data date, and link the Chaque Euro page. Each figure's provenance.citations[] names a source id, its recordUrl and its dataDate; the top-level sources map gives each source's name, publisher, pageUrl, fileUrl, licence and dataDate. Report figures as published: never infer favouritism, fraud or wrongdoing from them. Natural persons other than public officials are never named. Answer in the user's language.
Prefer filtered calls (query, departement, organisation, group, source) to unfiltered lists. Large tools return their headline figures and a sections list by default; pass section to get one part.
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

const COMMUNE_SECTIONS = ["history", "functions", "local", "buyer", "representatives"] as const;
const BUDGET_SECTIONS = ["publicFinances", "execution", "legislation"] as const;
const PUBLIC_MONEY_SECTIONS = ["socialAccounts"] as const;
const PROCUREMENT_SECTIONS = [
  "breakdown",
  "quality",
  "sanctions",
  "opportunities",
  "competition",
] as const;
const LOBBYING_SECTIONS = ["defaults", "european"] as const;

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

function reply(path: string, data: object, query: Query | URLSearchParams = {}): CallToolResult {
  const url = new URL(path, PUBLIC_ORIGIN);
  url.search = (query instanceof URLSearchParams ? query : searchParams(query)).toString();
  const structuredContent = compact({ url: url.href, ...data });
  return {
    structuredContent,
    content: [{ type: "text", text: JSON.stringify(structuredContent) }],
  };
}

function sectionInput<const T extends readonly [string, ...string[]]>(names: T) {
  return z
    .enum(names)
    .optional()
    .describe("Part to return. Without it, the headline figures and the list of sections.");
}

function bySection(data: Record<string, unknown>, sections: readonly string[], section?: string) {
  const entries = Object.entries(data).filter(([key]) =>
    section ? key === section || /provenance$/i.test(key) : !sections.includes(key),
  );
  return section
    ? Object.fromEntries(entries)
    : { ...Object.fromEntries(entries), sections: sections.filter((key) => data[key] !== null) };
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
        "Search by name across organisations (companies, associations, public bodies), communes, elected officials, public officials heading an administration and site topics. Each result has a site path whose last segment is the id for the detail tools (/organisation/<SIREN>, /commune/<INSEE>, /elus/<id>, /administrations/<id>). An acronym may only match subsidiaries or namesakes: then search the legal name (Electricité de France for EDF). Find an administration by its own name with list_administrations.",
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
        "One commune by INSEE code (Paris, Lyon and Marseille arrondissements map to their commune). By default, its accounts per inhabitant for one year against the median of communes of the same size. Sections: history (yearly accounts since 2018), functions (spending by service), local (local tax rates, income tax, electoral turnout, DGF), buyer (public contracts as buyer), representatives (deputies and senators). `year` selects the accounts year; the latest by default.",
      inputSchema: {
        insee,
        year: z.number().int().min(2000).max(2100).optional(),
        section: sectionInput(COMMUNE_SECTIONS),
      },
      annotations,
    },
    async ({ insee, year, section }) => {
      const code = communeCode(insee);
      const commune = await getCommune(code, year);
      if (!commune) return missing(`No commune with INSEE code ${insee}.`);
      if (year !== undefined && commune.accounts.year !== year) {
        const years = commune.history.map((entry) => entry.year).join(", ");
        return missing(`No ${year} accounts for ${commune.name}. Published years: ${years}.`);
      }
      const [local, functions, representatives] = await Promise.all([
        getCommuneLocal(code),
        getCommuneFunctions(code, commune.accounts.year),
        getCommuneRepresentatives(code),
      ]);
      return reply(
        `/commune/${code}`,
        bySection({ ...commune, local, functions, representatives }, COMMUNE_SECTIONS, section),
        { annee: year },
      );
    },
  );

  server.registerTool(
    "get_departement",
    {
      description:
        "One département by code (01 to 95, 2A, 2B, 971 to 976): spending per inhabitant of its communes against the median of communes of the same size (most populous first, 50 per page), accounts of the département council and its region over time, and electoral turnout.",
      inputSchema: {
        code: z
          .string()
          .regex(/^(\d{2}|2[AB]|97[1-6])$/)
          .describe("Département code"),
        page,
      },
      annotations,
    },
    async ({ code, page }) => {
      const departement = await getDepartement(code);
      if (!departement) return missing(`No département with code ${code}.`);
      const { communes } = departement;
      return reply(`/departement/${code}`, {
        departement: {
          ...departement,
          communes: pageOf(communes, page),
          communeCount: communes.length,
        },
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
        "The State's general budget (budget général). By default: total executed spending, by mission and programme, revenue by tax and budget voted for next year. Use it for the State budget; get_public_money family etat is a different perimeter (Insee national accounts of all State administrations). Sections: publicFinances (public finances by sub-sector since 1949), execution (monthly execution, spending by type and ministry, State balance sheet, green budget), legislation (the related finance laws).",
      inputSchema: { section: sectionInput(BUDGET_SECTIONS) },
      annotations,
    },
    async ({ section }) => {
      const [budget, execution, legislation] = await Promise.all([
        getStateBudget(),
        getStateExecution(),
        getBudgetLegislation("État"),
      ]);
      return reply(
        "/budget-etat",
        bySection({ ...budget, execution, legislation }, BUDGET_SECTIONS, section),
      );
    },
  );

  server.registerTool(
    "get_public_money",
    {
      description:
        "All French public money in Insee national accounts (State, State operators, local authorities, social security) by sector and by function, compulsory levies, European comparisons and quarterly debt. Pass `family` for one family's detailed accounts. Family etat covers all State administrations in national accounts, not the State's general budget: use get_state_budget for that. For securite-sociale, section socialAccounts gives the social security branches, ONDAM, health payers, pensions, family benefits and unemployment insurance.",
      inputSchema: {
        family: z.enum(PUBLIC_SECTORS.map((sector) => sector.slug)).optional(),
        section: sectionInput(PUBLIC_MONEY_SECTIONS),
      },
      annotations,
    },
    async ({ family, section }) => {
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
      return reply(
        `/argent-public/${sector.slug}`,
        bySection(
          {
            sector,
            family: accounts,
            protection,
            socialAccounts,
            legislation,
            functionLabels: PUBLIC_FUNCTIONS,
            memberLabels: PUBLIC_MEMBERS,
          },
          PUBLIC_MONEY_SECTIONS,
          section,
        ),
      );
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
        "Public procurement overview. By default: latest contracts, largest buyers and winners, contracts by buyer département. Sections: breakdown (contracts by month, procedure and type), quality (publication quality), sanctions (Competition Authority sanctions), opportunities (upcoming tenders), competition (single-bid rates).",
      inputSchema: { section: sectionInput(PROCUREMENT_SECTIONS) },
      annotations,
    },
    async ({ section }) => {
      const [procurement, opportunities, competition] = await Promise.all([
        getProcurement(),
        getProcurementOpportunities(),
        getProcurementCompetition(),
      ]);
      return reply(
        "/marches-publics",
        bySection({ ...procurement, opportunities, competition }, PROCUREMENT_SECTIONS, section),
      );
    },
  );

  server.registerTool(
    "get_lobbying",
    {
      description:
        "Lobbying registers (HATVP for France, EU Transparency Register). By default: totals, organisations with the most declared activities, targeted institutions and ministries, declared budgets and links with public contracts and State payments. Sections: defaults (HATVP declaration defaults, 50 per page), european (EU register). `organisation` filters lists by name.",
      inputSchema: {
        organisation: text.optional(),
        section: sectionInput(LOBBYING_SECTIONS),
        page: page.describe("Page of the defaults section, 50 per page"),
      },
      annotations,
    },
    async ({ organisation = "", section, page }) => {
      const data = await getLobbying(organisation);
      const defaults = { count: data.defaults.length, rows: pageOf(data.defaults, page) };
      return reply("/lobbying", bySection({ ...data, defaults }, LOBBYING_SECTIONS, section), {
        organisation,
      });
    },
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
        "Candidates' campaign accounts for the 2024 legislative or European elections (CNCCFP), 50 per page, with totals and counts by decision code. Filter by candidate or constituency name, département code or decision code. With `query`, also the matching entries of the index of 2026 municipal decisions (same page). Amounts are in cents.",
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
      const { municipal, municipalProvenance, ...campaigns } = index;
      const needle = normalizeSearch(query);
      const matches = municipal.filter((row) =>
        normalizeSearch(`${row.candidate_name} ${row.territory_label}`).includes(needle),
      );
      return reply(
        "/campagnes",
        query
          ? {
              ...campaigns,
              municipal: pageOf(matches, page),
              municipalCount: matches.length,
              municipalProvenance,
            }
          : campaigns,
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
        "Deputies and senators of a commune given by name or INSEE code. An ambiguous name returns candidate communes. A commune split between several constituencies has several deputies: pass the address longitude and latitude (WGS84) to get the single deputy of that address, as the site's address finder does; none is given within 200 m of a boundary. Without coordinates, the result gives the public geocoder to use for the user's address.",
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
        if (new Set(local.deputies.map((deputy) => deputy.constituency)).size < 2) {
          return reply("/elus#trouver", local, { commune });
        }
        const { endpoint, provenance } = await getAddressLookup();
        return reply(
          "/elus#trouver",
          {
            ...local,
            address: {
              geocoder: endpoint,
              instruction: `This commune is split between several constituencies. Geocode the user's street address with ${endpoint}?q=<address>&index=address&limit=5 (results are GeoJSON points, [longitude, latitude]), confirm the address with the user, then call find_representatives again with longitude and latitude. Or ask the user for the address.`,
              provenance,
            },
          },
          { commune },
        );
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
        "One public vote by id (e.g. VTANR5L17V9469 or SEN2026-46, from list_votes): result, counts by group and position, and vote corrections. Pass `group` (a group_label from groups) for each of its members' positions.",
      inputSchema: { id, group: text.optional() },
      annotations,
    },
    async ({ id, group }) => {
      const data = await getPublicBallot(id);
      if (!data) return missing(`No vote with id ${id}.`);
      const { votes, ...ballot } = data;
      return reply(
        `/votes/${encodeURIComponent(id)}`,
        group ? { ...ballot, votes: votes.filter((vote) => vote.group_label === group) } : ballot,
      );
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
        "One legislative file by id (e.g. an-DLR5L17N53329, from list_legislative_files): steps (50 per page), documents and the same law's files at other publishers.",
      inputSchema: { id, page },
      annotations,
    },
    async ({ id, page }) => {
      const data = await getLegislativeFile(id);
      if (!data) return missing(`No legislative file with id ${id}.`);
      const { events } = data;
      return reply(`/documents/dossiers/${encodeURIComponent(id)}`, {
        ...data,
        events: pageOf(events, page),
        eventCount: events.length,
      });
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
        "One administration by id (a UUID, from list_administrations or search): parent bodies, then child bodies and communes covered, 50 per page each.",
      inputSchema: { id, page },
      annotations,
    },
    async ({ id, page }) => {
      const data = await getAdministration(id);
      if (!data) return missing(`No administration with id ${id}.`);
      const { children, coverage } = data;
      return reply(`/administrations/${encodeURIComponent(id)}`, {
        ...data,
        children: pageOf(children, page),
        childCount: children.length,
        coverage: pageOf(coverage, page),
        coverageCount: coverage.length,
      });
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
        "Every source the site uses with its id, name, publisher, data date and freshness, plus the social protection total quoted on the methodology page. `source` filters by source name, publisher or id and gives each match in full: licence, coverage, rows, SHA-256, known limits, the first URL fetched and how many (every URL is in `allUrls`).",
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
            .map(({ urls, ...entry }) =>
              source
                ? { ...entry, urls: urls.slice(0, 1), urlCount: urls.length }
                : {
                    id: entry.id,
                    name: entry.name,
                    publisher: entry.publisher,
                    dataDate: entry.dataDate,
                    freshness: entry.freshness,
                  },
            ),
          allUrls: new URL("/methodologie/manifest.json", PUBLIC_ORIGIN).href,
        },
        socialProtection,
      });
    },
  );

  server.registerTool(
    "list_downloads",
    {
      description: `Derived data tables published under Licence Ouverte 2.0, with formats and sizes. Each file is at ${PUBLIC_ORIGIN}/telechargements/fichiers/<file>. \`table\` gives one table with the SHA-256 of its files.`,
      inputSchema: { table: text.optional() },
      annotations,
    },
    async ({ table }) => {
      const downloads = await getDownloads();
      return reply("/telechargements", {
        ...downloads,
        tables: table
          ? downloads.tables.filter((entry) => entry.table === table)
          : downloads.tables.map((entry) => ({
              ...entry,
              files: entry.files.map(({ file, format, bytes }) => ({ file, format, bytes })),
            })),
      });
    },
  );

  return server;
}
