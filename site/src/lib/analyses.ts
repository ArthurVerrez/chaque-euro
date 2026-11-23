import type { IconName } from "./icons";

export interface Analysis {
  slug: string;
  title: string;
  question: string;
  summary: string;
  short: string;
  accent: string;
  icon: IconName;
  published: string;
  updated?: string;
}

export const ANALYSES: Analysis[] = [
  {
    slug: "nantes",
    short: "Nantes et sa métropole",
    accent: "var(--series-1)",
    title: "Ce que dépensent Nantes Métropole et ses communes",
    question:
      "Comment compter une dépense une seule fois quand plusieurs collectivités la financent ?",
    summary:
      "Des comptes de la Ville à ceux des 24 communes et de la Métropole, en retirant les transferts entre elles.",
    icon: "layers",
    published: "2026-11-23",
  },
  {
    slug: "marseille",
    short: "Dépenses de Marseille",
    accent: "var(--series-2)",
    title: "À Marseille, pourquoi la dépense par habitant monte ou baisse selon le calcul",
    question: "Quelles dépenses ont progressé entre les comptes 2024 et 2025 de Marseille ?",
    summary: "Personnel, investissements et écoles dans les comptes exécutés de la Ville.",
    icon: "works",
    published: "2026-11-23",
  },
  {
    slug: "lille",
    short: "Dette de Lille",
    accent: "var(--series-7)",
    title: "Pourquoi Lille a davantage emprunté en 2025",
    question: "Pourquoi la dette de Lille augmente-t-elle en 2025 ?",
    summary: "Emprunts, remboursements et réserves dans les comptes de la commune de 2018 à 2025.",
    icon: "debt",
    published: "2026-11-23",
  },
  {
    slug: "comparer-les-communes",
    short: "Comparer les communes",
    accent: "var(--series-3)",
    title: "Combien dépense une grande ville par habitant ?",
    question: "Pourquoi les mêmes comptes donnent-ils trois réponses différentes ?",
    summary:
      "De Lyon à Blacé, comment choisir les communes à comparer et refaire la médiane des grandes villes.",
    icon: "compare",
    published: "2026-11-23",
  },
  {
    slug: "deficit-par-president",
    short: "Déficit par président",
    accent: "var(--series-1)",
    title: "Le déficit public, président par président",
    question: "Comment le déficit et la dette ont-ils évolué au fil des présidences ?",
    summary: "Déficit et dette sur longue période, avec les crises en repère.",
    icon: "trend",
    published: "2026-11-02",
  },
  {
    slug: "europe",
    short: "Budget de l’UE",
    accent: "var(--series-7)",
    title: "L’Europe : ce que la France verse et ce qu’elle reçoit",
    question: "Combien la France verse-t-elle au budget européen, et combien reçoit-elle ?",
    summary: "Contribution, dépenses en France et solde, relance comptée à part.",
    icon: "europe",
    published: "2026-11-02",
  },
  {
    slug: "paris",
    short: "Dépenses de Paris",
    accent: "var(--series-2)",
    title: "Pourquoi Paris dépense plus par habitant",
    question: "Pourquoi les dépenses par habitant sont-elles plus élevées à Paris ?",
    summary: "Paris est commune et département : comparer à périmètre égal.",
    icon: "town",
    published: "2026-11-02",
  },
  {
    slug: "rail",
    short: "Financement du rail",
    accent: "var(--series-3)",
    title: "Le rail : combien pour les finances publiques",
    question: "Qui finance les trains, entre voyageurs et administrations publiques ?",
    summary: "Transferts publics, recettes commerciales et dette reprise, présentés séparément.",
    icon: "transport",
    published: "2026-11-02",
    updated: "2026-11-23",
  },
  {
    slug: "etudiants",
    short: "Aides aux étudiants",
    accent: "var(--series-5)",
    title: "Étudiants : ce qu’ils demandent, ce que l’État dépense",
    question: "Quels moyens publics face aux demandes des étudiants ?",
    summary: "Bourses, restauration, logement : ce qui est dépensé, voté ou proposé.",
    icon: "school",
    published: "2026-11-02",
  },
];

export function analysis(slug: string): Analysis {
  const article = ANALYSES.find((entry) => entry.slug === slug);
  if (!article) throw new Error(`Unknown analysis ${slug}`);
  return article;
}

export const ANALYSIS_TOPICS = [
  {
    slug: "finances-locales",
    label: "Finances locales",
    articles: ["nantes", "marseille", "lille", "comparer-les-communes", "paris"],
  },
  {
    slug: "etat-et-europe",
    label: "État et Europe",
    articles: ["deficit-par-president", "europe"],
  },
  { slug: "services-publics", label: "Services publics", articles: ["rail", "etudiants"] },
];

export function analysisTopic(slug: string) {
  return ANALYSIS_TOPICS.find((topic) => topic.articles.includes(slug));
}

const covers: Record<string, { alt: string; width: number }> = {
  nantes: {
    width: 1100,
    alt: "La grue jaune des anciens chantiers navals domine les quais de la Loire.",
  },
  marseille: {
    width: 760,
    alt: "Le Vieux-Port de Marseille et la silhouette de Notre-Dame de la Garde.",
  },
  lille: { width: 760, alt: "Le beffroi de Lille surplombe les façades à pignons." },
  "comparer-les-communes": { width: 1080, alt: "Les quais de Saône et les maisons du Vieux Lyon." },
  "deficit-par-president": {
    width: 1080,
    alt: "Les rangées de sièges de l’hémicycle de l’Assemblée nationale.",
  },
  europe: { width: 1080, alt: "Le Parlement européen de Strasbourg se reflète dans l’eau." },
  paris: { width: 1080, alt: "La façade de l’Hôtel de Ville de Paris vue depuis le parvis." },
  rail: { width: 1080, alt: "Un train régional suit une courbe entre les champs." },
  etudiants: {
    width: 1080,
    alt: "Des étudiants prennent des notes sur les bancs d’un amphithéâtre.",
  },
};

export function analysisCover(slug: string) {
  const cover = covers[slug];
  return cover
    ? {
        ...cover,
        src: `/images/analyses/${slug}.webp`,
        thumbnail: `/images/analyses/miniatures/${slug}.webp`,
      }
    : null;
}
