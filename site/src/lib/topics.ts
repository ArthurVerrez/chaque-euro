import type { IconName } from "./icons";

interface Topic {
  title: string;
  href: string;
  icon: IconName;
  synonyms: string[];
}

export const TOPICS: Topic[] = [
  {
    title: "Impôts et cotisations",
    href: "/argent-public#prelevements",
    icon: "revenue",
    synonyms: ["impôt", "impôts", "taxes", "prélèvements", "cotisations"],
  },
  {
    title: "TVA",
    href: "/budget-etat#recettes",
    icon: "vat",
    synonyms: ["TVA", "taxe sur la valeur ajoutée"],
  },
  {
    title: "Impôt sur le revenu",
    href: "/budget-etat#recettes",
    icon: "incomeTax",
    synonyms: ["impôt sur le revenu", "impôts sur le revenu", "IR"],
  },
  {
    title: "Dette publique",
    href: "/argent-public#dette",
    icon: "debt",
    synonyms: ["dette", "dette publique", "emprunt", "endettement"],
  },
  {
    title: "Le déficit public, président par président",
    href: "/analyses/deficit-par-president#solde",
    icon: "trend",
    synonyms: ["déficit", "déficit public", "présidents", "solde public"],
  },
  {
    title: "Retraites",
    href: "/argent-public/securite-sociale#retraites",
    icon: "socialSecurity",
    synonyms: ["retraite", "retraites", "pensions", "retraités"],
  },
  {
    title: "Santé",
    href: "/argent-public/securite-sociale#sante",
    icon: "health",
    synonyms: ["santé", "soins", "hôpital", "hôpitaux", "médecin", "assurance maladie"],
  },
  {
    title: "Chômage",
    href: "/argent-public/securite-sociale#chomage",
    icon: "unemployment",
    synonyms: ["chômage", "chômeurs", "assurance chômage", "Unédic", "allocations chômage"],
  },
  {
    title: "École et éducation",
    href: "/budget-etat#missions",
    icon: "school",
    synonyms: ["école", "écoles", "éducation", "enseignement scolaire", "professeurs"],
  },
  {
    title: "Défense",
    href: "/budget-etat#missions",
    icon: "defense",
    synonyms: ["armée", "armées", "défense", "militaires"],
  },
  {
    title: "Sécurité",
    href: "/budget-etat#missions",
    icon: "security",
    synonyms: ["police", "gendarmes", "gendarmerie", "sécurité intérieure"],
  },
  {
    title: "L’Europe : ce que la France verse et ce qu’elle reçoit",
    href: "/analyses/europe",
    icon: "europe",
    synonyms: ["Europe", "Union européenne", "UE", "budget européen"],
  },
  {
    title: "Le rail : combien pour les finances publiques",
    href: "/analyses/rail",
    icon: "transport",
    synonyms: ["SNCF", "train", "trains", "rail", "ferroviaire", "TGV"],
  },
  {
    title: "Étudiants : ce qu’ils demandent, ce que l’État dépense",
    href: "/analyses/etudiants",
    icon: "school",
    synonyms: ["étudiant", "étudiants", "bourses", "universités", "Crous", "études supérieures"],
  },
  {
    title: "Pourquoi Paris dépense plus par habitant",
    href: "/analyses/paris",
    icon: "town",
    synonyms: ["Paris", "budget Paris", "dépenses Paris"],
  },
  {
    title: "Associations",
    href: "/organisations#associations",
    icon: "association",
    synonyms: [
      "association",
      "associations",
      "subvention",
      "subventions",
      "aides aux associations",
    ],
  },
  {
    title: "Les marchés publics",
    href: "/marches-publics",
    icon: "contract",
    synonyms: [
      "marché public",
      "marchés publics",
      "commande publique",
      "appels d'offres",
      "contrats publics",
    ],
  },
  {
    title: "Lobbying et argent public",
    href: "/lobbying",
    icon: "lobbying",
    synonyms: ["lobbying", "lobby", "lobbies", "influence", "représentants d'intérêts"],
  },
  {
    title: "Le financement des partis politiques",
    href: "/financement-politique",
    icon: "politicalFinance",
    synonyms: [
      "parti",
      "partis",
      "financement politique",
      "financement des partis",
      "dons politiques",
    ],
  },
  {
    title: "Élus",
    href: "/elus",
    icon: "elected",
    synonyms: ["élu", "élus", "responsables publics", "parlementaires"],
  },
  {
    title: "Trouver votre député par commune",
    href: "/elus#trouver",
    icon: "elected",
    synonyms: [
      "député",
      "députée",
      "députés",
      "mon député",
      "ma députée",
      "Assemblée nationale",
      "circonscription",
    ],
  },
  {
    title: "Sénateurs",
    href: "/elus?chambre=SENAT#repertoire",
    icon: "elected",
    synonyms: ["sénateur", "sénatrice", "sénateurs", "Sénat"],
  },
  {
    title: "Répertoire national et maires",
    href: "/elus/registre",
    icon: "town",
    synonyms: ["maire", "maires", "conseillers municipaux", "élus locaux"],
  },
  {
    title: "Membres du gouvernement",
    href: "/elus?chambre=minister#repertoire",
    icon: "state",
    synonyms: ["ministre", "ministres", "gouvernement", "premier ministre"],
  },
  {
    title: "Le budget de l'État, mission par mission",
    href: "/budget-etat",
    icon: "state",
    synonyms: ["budget", "budget État", "dépenses État", "finances État"],
  },
  {
    title: "Sécurité sociale",
    href: "/argent-public/securite-sociale",
    icon: "socialSecurity",
    synonyms: ["sécurité sociale", "sécu", "protection sociale"],
  },
  {
    title: "Communes et départements",
    href: "/communes#carte",
    icon: "town",
    synonyms: [
      "commune",
      "communes",
      "ville",
      "villes",
      "département",
      "départements",
      "budget municipal",
    ],
  },
  {
    title: "Comptes des régions et collectivités uniques",
    href: "/regions",
    icon: "region",
    synonyms: ["région", "régions", "budget régional"],
  },
  {
    title: "Journal officiel",
    href: "/journal-officiel",
    icon: "journal",
    synonyms: ["Journal officiel", "JO", "JORF", "décret", "décrets", "nominations"],
  },
  {
    title: "Dossiers législatifs",
    href: "/documents/dossiers",
    icon: "legislation",
    synonyms: ["loi", "lois", "législation", "dossiers législatifs", "projet de loi"],
  },
];

export function normalizeSearch(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  ).join(" ");
}

export function searchTopics(query: string): Topic[] {
  const words = normalizeSearch(query)
    .split(" ")
    .filter(
      (word) =>
        ![
          "mon",
          "ma",
          "mes",
          "le",
          "la",
          "les",
          "l",
          "de",
          "des",
          "du",
          "d",
          "un",
          "une",
          "votre",
          "vos",
          "comment",
          "combien",
          "pour",
          "sur",
        ].includes(word),
    );
  if (!words.length || !words[0]) return [];
  return TOPICS.filter((topic) =>
    [topic.title, ...topic.synonyms].some((label) => {
      const candidates = normalizeSearch(label).split(" ");
      return words.every((word) => candidates.some((candidate) => candidate.startsWith(word)));
    }),
  ).sort(
    (a, b) =>
      Number(b.synonyms.some((label) => normalizeSearch(label) === words.join(" "))) -
      Number(a.synonyms.some((label) => normalizeSearch(label) === words.join(" "))),
  );
}
