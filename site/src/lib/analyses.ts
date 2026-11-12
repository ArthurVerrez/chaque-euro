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
}

export const ANALYSES: Analysis[] = [
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
    short: "L'Europe",
    accent: "var(--series-7)",
    title: "L’Europe : ce que la France verse et ce qu’elle reçoit",
    question: "Combien la France verse-t-elle au budget européen, et combien reçoit-elle ?",
    summary: "Contribution, dépenses en France et solde, relance comptée à part.",
    icon: "europe",
    published: "2026-11-02",
  },
  {
    slug: "paris",
    short: "Paris",
    accent: "var(--series-2)",
    title: "Pourquoi Paris dépense plus par habitant",
    question: "Pourquoi les dépenses par habitant sont-elles plus élevées à Paris ?",
    summary: "Paris est commune et département : comparer à périmètre égal.",
    icon: "town",
    published: "2026-11-02",
  },
  {
    slug: "rail",
    short: "Le rail",
    accent: "var(--series-3)",
    title: "Le rail : combien pour les finances publiques",
    question: "Qui finance les trains, entre voyageurs et administrations publiques ?",
    summary: "Transferts publics, recettes commerciales et dette reprise, présentés séparément.",
    icon: "transport",
    published: "2026-11-02",
  },
  {
    slug: "etudiants",
    short: "Étudiants",
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
