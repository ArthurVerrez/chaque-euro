import type {
  CommuneAccounts,
  PublicAccountLine,
  PublicFamily,
  PublicMoney,
  StateBudget,
} from "./data";
import type { IconName } from "./icons";

export type FlowTone = "in" | "out" | "transfer" | "gap" | "hub";

export interface FlowPart {
  label: string;
  value: number;
  icon: IconName;
  tone: FlowTone;
  other?: boolean;
}

export interface Flow {
  hub: FlowPart;
  inflows: FlowPart[];
  outflows: FlowPart[];
}

const STATE_TAXES: { code: string; label: string; icon: IconName }[] = [
  { code: "16", label: "TVA", icon: "vat" },
  { code: "11", label: "Impôt sur le revenu", icon: "incomeTax" },
  { code: "13", label: "Impôt sur les sociétés", icon: "corporateTax" },
  { code: "15", label: "Taxe sur les carburants et l'énergie", icon: "fuel" },
];

const STATE_TRANSFERS: Record<string, { label: string; icon: IconName }> = {
  "31": { label: "Reversé aux collectivités", icon: "town" },
  "32": { label: "Reversé à l'Union européenne", icon: "europe" },
};

const MISSION_ICONS: Record<string, IconName> = {
  "Remboursements et dégrèvements": "refund",
  "Enseignement scolaire": "school",
  Défense: "defense",
  "Engagements financiers de l'État": "interest",
  "Solidarité, insertion et égalité des chances": "solidarity",
  "Recherche et enseignement supérieur": "research",
};

const TOP_MISSIONS = 6;

type Gap = Pick<FlowPart, "label" | "icon">;

const sum = (parts: FlowPart[]) => parts.reduce((total, part) => total + part.value, 0);

function balance(
  label: string,
  candidates: { inflows: FlowPart[]; outflows: FlowPart[] },
  shortfall: Gap,
  surplus: Gap,
): Flow {
  const inflows = candidates.inflows.filter((part) => part.value > 0);
  const outflows = candidates.outflows.filter((part) => part.value > 0);
  const difference = sum(outflows) - sum(inflows);
  if (difference > 0) inflows.push({ ...shortfall, value: difference, tone: "gap" });
  if (difference < 0) outflows.push({ ...surplus, value: -difference, tone: "gap" });
  return { hub: { label, value: sum(inflows), icon: "flow", tone: "hub" }, inflows, outflows };
}

export function stateFlow(budget: StateBudget): Flow {
  const lines = budget.revenue.lines;
  const total = (prefix: string, exclude: string[] = []) =>
    lines
      .filter((line) => line.code.startsWith(prefix) && !exclude.includes(line.code))
      .reduce((value, line) => value + line.amount, 0);
  const taxes = STATE_TAXES.map(({ code, label, icon }) => ({
    label,
    icon,
    value: total(code),
    tone: "in" as const,
  }));
  const inflows: FlowPart[] = [
    ...taxes,
    {
      label: "Autres impôts et taxes",
      icon: "otherTaxes",
      value: total(
        "1",
        STATE_TAXES.map((tax) => tax.code),
      ),
      tone: "in",
      other: true,
    },
    {
      label: "Recettes non fiscales",
      icon: "otherRevenue",
      value: total("2"),
      tone: "in",
      other: true,
    },
    {
      label: "Contributions d'autres organismes",
      icon: "contribution",
      value: total("5"),
      tone: "in",
      other: true,
    },
  ];
  const transfers = lines
    .filter((line) => line.code.startsWith("3"))
    .map((line) => ({
      label: STATE_TRANSFERS[line.code]?.label ?? line.name,
      icon: STATE_TRANSFERS[line.code]?.icon ?? "state",
      value: -line.amount,
      tone: "transfer" as const,
    }));
  const rest = budget.missions.slice(TOP_MISSIONS);
  const outflows: FlowPart[] = [
    ...transfers,
    ...budget.missions.slice(0, TOP_MISSIONS).map((mission) => ({
      label: mission.name,
      icon: MISSION_ICONS[mission.name] ?? "layers",
      value: mission.spent,
      tone: "out" as const,
    })),
    {
      label: `Les ${rest.length} autres missions`,
      icon: "layers",
      value: rest.reduce((value, mission) => value + mission.spent, 0),
      tone: "out",
      other: true,
    },
  ];
  return balance(
    `Budget de l'État ${budget.year}`,
    { inflows, outflows },
    { label: "Déficit, financé par l'emprunt", icon: "debt" },
    { label: "Excédent", icon: "savings" },
  );
}

export function communeFlow(accounts: CommuneAccounts): Flow {
  const amount = (item: string) => accounts.lines.find((line) => line.item === item)?.amount ?? 0;
  const operatingRest =
    amount("fonctionnement") -
    amount("personnel") -
    amount("achats") -
    amount("intervention") -
    amount("interets");
  const investmentRest =
    amount("investissement") - amount("equipement") - amount("subventions_equipement");
  const inflows: FlowPart[] = [
    { label: "Impôts locaux", icon: "localTax", value: amount("impots_locaux"), tone: "in" },
    {
      label: "Dotation globale de fonctionnement (État)",
      icon: "state",
      value: amount("dgf"),
      tone: "in",
    },
    {
      label: "Autres recettes",
      icon: "otherRevenue",
      value: amount("recettes") - amount("impots_locaux") - amount("dgf"),
      tone: "in",
      other: true,
    },
  ];
  const outflows: FlowPart[] = [
    {
      label: "Salaires et charges du personnel",
      icon: "staff",
      value: amount("personnel"),
      tone: "out",
    },
    {
      label: "Achats et services extérieurs",
      icon: "purchases",
      value: amount("achats"),
      tone: "out",
    },
    {
      label: "Aides, subventions et participations",
      icon: "grant",
      value: amount("intervention"),
      tone: "out",
    },
    { label: "Travaux et équipements", icon: "works", value: amount("equipement"), tone: "out" },
    {
      label: "Subventions d'équipement versées",
      icon: "grant",
      value: amount("subventions_equipement"),
      tone: "out",
    },
    { label: "Intérêts de la dette", icon: "interest", value: amount("interets"), tone: "out" },
    {
      label: "Autres dépenses",
      icon: "other",
      value: Math.max(operatingRest, 0) + Math.max(investmentRest, 0),
      tone: "out",
      other: true,
    },
  ];
  return balance(
    `Budget ${accounts.year}`,
    { inflows, outflows },
    { label: "Emprunt ou réserves", icon: "debt" },
    { label: "Excédent : remboursement de la dette et réserves", icon: "savings" },
  );
}

export const PUBLIC_SECTORS: {
  code: string;
  slug: string;
  name: string;
  icon: IconName;
  description: string;
}[] = [
  {
    code: "S13111",
    slug: "etat",
    name: "État",
    icon: "state",
    description: "Présidence, gouvernement, ministères, Parlement et tribunaux.",
  },
  {
    code: "S13112",
    slug: "operateurs",
    name: "Opérateurs de l'État",
    icon: "building",
    description:
      "Organismes chargés d’une mission nationale spécialisée : enseignement supérieur, recherche, musées nationaux.",
  },
  {
    code: "S1313",
    slug: "collectivites",
    name: "Collectivités locales",
    icon: "town",
    description:
      "Communes, départements, régions, intercommunalités et organismes divers d’administration locale.",
  },
  {
    code: "S1314",
    slug: "securite-sociale",
    name: "Sécurité sociale",
    icon: "socialSecurity",
    description: "Régimes d’assurance sociale et organismes qui en dépendent, dont les hôpitaux.",
  },
];

export const PUBLIC_MEMBERS: Record<string, { name: string; icon: IconName }> = {
  S131311: { name: "Communes", icon: "town" },
  S131312: { name: "Départements", icon: "map" },
  S131313: { name: "Régions", icon: "map" },
  S131314: { name: "Syndicats", icon: "town" },
  S13132: { name: "Organismes divers d'administration locale", icon: "building" },
  S13141: { name: "Régimes d'assurance sociale", icon: "socialSecurity" },
  S13142: { name: "Organismes dépendant des assurances sociales, dont hôpitaux", icon: "health" },
};

export function familyFlow(family: PublicFamily): Flow {
  const amount = (block: PublicAccountLine["block"], ...codes: string[]) =>
    family.lines
      .filter((line) => line.block === block && codes.includes(line.code))
      .reduce((total, line) => total + line.amount, 0);
  const taxes = amount("recettes", "D2", "D5", "D91r", "D733", "D995r");
  const contributions = amount("recettes", "D61");
  const transfers = amount("recettes", "D73 hors D733");
  const outflows: FlowPart[] = [
    {
      label: "Prestations sociales",
      icon: "solidarity",
      value: amount("depenses", "D62", "D632"),
      tone: "out",
    },
    { label: "Salaires", icon: "staff", value: amount("depenses", "D1"), tone: "out" },
    { label: "Achats", icon: "purchases", value: amount("depenses", "P2"), tone: "out" },
    {
      label: "Investissement",
      icon: "works",
      value: amount("depenses", "P51g", "P52, P53, NP"),
      tone: "out",
    },
    {
      label: "Intérêts de la dette",
      icon: "interest",
      value: amount("depenses", "D41"),
      tone: "out",
    },
    {
      label: "Versé à d'autres administrations",
      icon: "contribution",
      value: amount("depenses", "D73"),
      tone: "transfer",
    },
  ];
  outflows.push({
    label: "Subventions et autres transferts",
    icon: "grant",
    value: family.spending - sum(outflows),
    tone: "out",
    other: true,
  });
  const sector = PUBLIC_SECTORS.find((entry) => entry.code === family.sector);
  const flow = balance(
    `${sector?.name ?? family.sector} ${family.year}`,
    {
      inflows: [
        { label: "Impôts", icon: "otherTaxes", value: taxes, tone: "in" },
        { label: "Cotisations sociales", icon: "socialSecurity", value: contributions, tone: "in" },
        {
          label: "Versements d'autres administrations",
          icon: "contribution",
          value: transfers,
          tone: "transfer",
        },
        {
          label: "Ventes et autres recettes",
          icon: "otherRevenue",
          value: family.revenue - taxes - contributions - transfers,
          tone: "in",
          other: true,
        },
      ],
      outflows,
    },
    { label: "Déficit, financé par l'emprunt", icon: "debt" },
    { label: "Excédent", icon: "savings" },
  );
  flow.hub.icon = sector?.icon ?? "building";
  return flow;
}

export const PUBLIC_FUNCTIONS: Record<string, { label: string; icon: IconName }> = {
  GF01: { label: "Administration et intérêts de la dette", icon: "administration" },
  GF02: { label: "Défense", icon: "defense" },
  GF03: { label: "Police, justice et secours", icon: "security" },
  GF04: { label: "Transports, économie et emploi", icon: "transport" },
  GF05: { label: "Environnement", icon: "ecology" },
  GF06: { label: "Logement et équipements", icon: "housing" },
  GF07: { label: "Santé", icon: "health" },
  GF08: { label: "Culture, sport et loisirs", icon: "culture" },
  GF09: { label: "Enseignement", icon: "school" },
  GF10: { label: "Retraites et protection sociale", icon: "solidarity" },
};

export function publicMoneyFlow(money: PublicMoney): Flow {
  const { functions, finances } = money;
  const name = (code: string) =>
    finances.sectors.find((sector) => sector.code === code)?.name ?? code;
  const inflows: FlowPart[] = PUBLIC_SECTORS.map(({ code, icon }) => ({
    label: name(code),
    icon,
    value: functions.sectors.find((sector) => sector.code === code)?.spending ?? 0,
    tone: "in",
  }));
  const outflows: FlowPart[] = functions.functions.map(({ code, spending }) => ({
    label: PUBLIC_FUNCTIONS[code]?.label ?? code,
    icon: PUBLIC_FUNCTIONS[code]?.icon ?? "other",
    value: spending,
    tone: "out",
  }));
  return {
    hub: {
      label: `Tout l'argent public ${functions.year}`,
      value: sum(outflows),
      icon: "euro",
      tone: "hub",
    },
    inflows,
    outflows,
  };
}
