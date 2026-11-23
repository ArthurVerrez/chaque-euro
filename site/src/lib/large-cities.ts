import type { LargeCity } from "./data";
import { formatChange, formatEuro, formatPercent } from "./format.ts";
import type { IconName } from "./icons";

export const FIRST_YEAR = 2019;
export const LAST_YEAR = 2025;

export interface Metric {
  item: string;
  label: string;
  subject: string;
  agreement: "fs" | "fp" | "ms" | "mp";
  icon: IconName;
  rate?: boolean;
  since?: number;
}

export const METRICS: Metric[] = [
  {
    item: "taxe_fonciere",
    label: "Taux de taxe foncière",
    subject: "le taux de taxe foncière",
    agreement: "ms",
    icon: "housing",
    rate: true,
    since: 2021,
  },
  {
    item: "dette",
    label: "Dette au 31 décembre",
    subject: "la dette par habitant",
    agreement: "fs",
    icon: "debt",
  },
  {
    item: "impots_locaux",
    label: "Impôts locaux",
    subject: "les impôts locaux par habitant",
    agreement: "mp",
    icon: "localTax",
  },
  {
    item: "depenses",
    label: "Dépenses",
    subject: "les dépenses par habitant",
    agreement: "fp",
    icon: "spending",
  },
  {
    item: "personnel",
    label: "Frais de personnel",
    subject: "les frais de personnel par habitant",
    agreement: "mp",
    icon: "staff",
  },
  {
    item: "equipement",
    label: "Travaux et équipements",
    subject: "les travaux et équipements par habitant",
    agreement: "mp",
    icon: "works",
  },
  {
    item: "interets",
    label: "Intérêts de la dette",
    subject: "les intérêts de la dette par habitant",
    agreement: "mp",
    icon: "interest",
  },
  {
    item: "subventions_privees",
    label: "Subventions aux associations et organismes privés",
    subject: "les subventions aux associations par habitant",
    agreement: "fp",
    icon: "association",
  },
  {
    item: "dgf",
    label: "Dotation globale de fonctionnement de l’État",
    subject: "la dotation de l’État par habitant",
    agreement: "fs",
    icon: "state",
  },
];

export const METRIC_ITEMS = METRICS.map((metric) => metric.item);

export const firstYear = (metric: Metric) => metric.since ?? FIRST_YEAR;

export const formatValue = (metric: Metric, value: number) =>
  metric.rate ? formatPercent(value / 100, 2) : formatEuro(value);

export const valueNote = (metric: Metric, year: number) =>
  metric.rate ? `taux net en ${year}` : `par habitant en ${year}`;

export interface CityStat {
  metric: Metric;
  first: number | null;
  last: number;
  change: number | null;
  rank: number;
  count: number;
  changeRank: number | null;
  changeCount: number;
  median: number;
}

export function median(values: number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

const changeOf = (city: LargeCity, metric: Metric) => {
  const first = city.values[metric.item]?.[firstYear(metric)];
  const last = city.values[metric.item]?.[LAST_YEAR];
  return first && last !== undefined ? last / first - 1 : null;
};

export function cityStats(cities: LargeCity[], city: LargeCity): CityStat[] {
  return METRICS.flatMap((metric) => {
    const last = city.values[metric.item]?.[LAST_YEAR];
    if (last === undefined) return [];
    const levels = cities.flatMap((other) => other.values[metric.item]?.[LAST_YEAR] ?? []);
    const changes = cities.flatMap((other) => changeOf(other, metric) ?? []);
    const change = changeOf(city, metric);
    return [
      {
        metric,
        first: city.values[metric.item]?.[firstYear(metric)] ?? null,
        last,
        change,
        rank: levels.filter((value) => value > last).length + 1,
        count: levels.length,
        changeRank: change === null ? null : changes.filter((value) => value > change).length + 1,
        changeCount: changes.length,
        median: median(levels),
      },
    ];
  });
}

const NOTABLE_CHANGE = 0.25;
const edge = (rank: number, count: number) => Math.min(rank, count + 1 - rank);
const notableChange = (stat: CityStat) =>
  stat.changeRank !== null && Math.abs(stat.change ?? 0) >= NOTABLE_CHANGE;
const weightedEdge = (rank: number, count: number) => (rank <= count / 2 ? rank : count + 2 - rank);

export function standoutStats(stats: CityStat[], limit = 4): CityStat[] {
  const score = (stat: CityStat) =>
    Math.min(
      weightedEdge(stat.rank, stat.count),
      notableChange(stat) ? weightedEdge(stat.changeRank!, stat.changeCount) : Infinity,
    ) -
    Math.min(Math.abs(stat.change ?? 0), 1) +
    METRICS.indexOf(stat.metric) * 0.25;
  return stats.toSorted((a, b) => score(a) - score(b)).slice(0, limit);
}

const ordinal = (rank: number) => (rank === 1 ? "" : `${rank}e `);

export function rankText(rank: number, count: number): string {
  return rank <= count / 2
    ? `${ordinal(rank)}niveau le plus élevé des ${count} grandes villes`
    : `${ordinal(count + 1 - rank)}niveau le plus bas des ${count} grandes villes`;
}

export function changeRankText(rank: number, count: number): string {
  return rank <= count / 2
    ? `${ordinal(rank)}plus forte hausse des ${count} grandes villes`
    : `${ordinal(count + 1 - rank)}plus forte baisse des ${count} grandes villes`;
}

export function medianByYear(cities: LargeCity[], item: string, years: number[]): number[] {
  return years.map((year) => median(cities.flatMap((city) => city.values[item]?.[year] ?? [])));
}

export function cityLabel(city: LargeCity, cities: LargeCity[]): string {
  return cities.some((other) => other !== city && other.name === city.name)
    ? `${city.name} (${city.departmentCode})`
    : city.name;
}

export function ofCity(name: string): string {
  if (name.startsWith("Le ")) return `du ${name.slice(3)}`;
  if (name.startsWith("Les ")) return `des ${name.slice(4)}`;
  return /^[AEIOUYÉÈÂ]/i.test(name) ? `d’${name}` : `de ${name}`;
}

export function leadsWithChange(stat: CityStat): boolean {
  return (
    notableChange(stat) && edge(stat.changeRank!, stat.changeCount) < edge(stat.rank, stat.count)
  );
}

export function statSentence(stat: CityStat, city: string): string {
  const { metric } = stat;
  const plural = metric.agreement[1] === "p";
  const subject = `${metric.subject.charAt(0).toUpperCase()}${metric.subject.slice(1)} ${ofCity(city)}`;
  if (leadsWithChange(stat) && stat.first !== null && stat.change !== null) {
    const passed = `passé${metric.agreement[0] === "f" ? "e" : ""}${plural ? "s" : ""}`;
    return `${subject} ${plural ? "sont" : "est"} ${passed} de ${formatValue(metric, stat.first)} à ${formatValue(metric, stat.last)} entre ${firstYear(metric)} et ${LAST_YEAR} (${formatChange(stat.change)}), la ${changeRankText(stat.changeRank!, stat.changeCount)}.`;
  }
  return `En ${LAST_YEAR}, ${subject.charAt(0).toLowerCase()}${subject.slice(1)} ${plural ? "atteignent" : "atteint"} ${formatValue(metric, stat.last)}, le ${rankText(stat.rank, stat.count)}.`;
}

export function headline(stat: CityStat, city: string): string {
  const { subject, agreement } = stat.metric;
  const feminine = agreement[0] === "f";
  const plural = agreement[1] === "p";
  if (leadsWithChange(stat) && stat.change !== null) {
    const moved =
      stat.change >= 1
        ? "plus que doublé"
        : `${stat.change < 0 ? "baissé" : "augmenté"} de ${formatPercent(Math.abs(stat.change))}`;
    return `${city} : ${subject} ${plural ? "ont" : "a"} ${moved} depuis ${firstYear(stat.metric)}`;
  }
  const groups = `des ${stat.count} grandes villes`;
  const article = plural ? "les" : feminine ? "la" : "le";
  if (stat.rank > stat.count / 2) {
    const lowest = feminine ? `basse${plural ? "s" : ""}` : "bas";
    return stat.rank === stat.count
      ? `${city} : ${subject} ${article} plus ${lowest} ${groups}`
      : `${city} : ${subject} parmi les plus ${feminine ? "basses" : "bas"} ${groups}`;
  }
  const highest = `élevé${feminine ? "e" : ""}${plural ? "s" : ""}`;
  return stat.rank === 1
    ? `${city} : ${subject} ${article} plus ${highest} ${groups}`
    : `${city} : ${subject} au ${stat.rank}e rang ${groups}`;
}
