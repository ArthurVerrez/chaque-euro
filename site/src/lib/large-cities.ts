import type { LargeCity } from "./data";
import { formatChange, formatEuro } from "./format.ts";
import type { IconName } from "./icons";

export const FIRST_YEAR = 2019;
export const LAST_YEAR = 2025;

export interface Metric {
  item: string;
  label: string;
  of: string;
  icon: IconName;
}

export const METRICS: Metric[] = [
  { item: "dette", label: "Dette au 31 décembre", of: "de dette", icon: "debt" },
  { item: "impots_locaux", label: "Impôts locaux", of: "d’impôts locaux", icon: "localTax" },
  { item: "depenses", label: "Dépenses", of: "de dépenses", icon: "spending" },
  { item: "personnel", label: "Frais de personnel", of: "de frais de personnel", icon: "staff" },
  {
    item: "equipement",
    label: "Travaux et équipements",
    of: "de travaux et d’équipements",
    icon: "works",
  },
  { item: "interets", label: "Intérêts de la dette", of: "d’intérêts", icon: "interest" },
  {
    item: "subventions_privees",
    label: "Subventions aux associations et organismes privés",
    of: "de subventions aux associations et organismes privés",
    icon: "association",
  },
  {
    item: "dgf",
    label: "Dotation globale de fonctionnement de l’État",
    of: "de dotation de l’État",
    icon: "state",
  },
];

export const METRIC_ITEMS = METRICS.map((metric) => metric.item);

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

const changeOf = (city: LargeCity, item: string) => {
  const first = city.perCapita[item]?.[FIRST_YEAR];
  const last = city.perCapita[item]?.[LAST_YEAR];
  return first && last !== undefined ? last / first - 1 : null;
};

export function cityStats(cities: LargeCity[], city: LargeCity): CityStat[] {
  return METRICS.flatMap((metric) => {
    const last = city.perCapita[metric.item]?.[LAST_YEAR];
    if (last === undefined) return [];
    const levels = cities.flatMap((other) => other.perCapita[metric.item]?.[LAST_YEAR] ?? []);
    const changes = cities.flatMap((other) => changeOf(other, metric.item) ?? []);
    const change = changeOf(city, metric.item);
    return [
      {
        metric,
        first: city.perCapita[metric.item]?.[FIRST_YEAR] ?? null,
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

const edge = (rank: number, count: number) => Math.min(rank, count + 1 - rank);
const weightedEdge = (rank: number, count: number) => (rank <= count / 2 ? rank : count + 2 - rank);

export function standoutStats(stats: CityStat[], limit = 4): CityStat[] {
  const score = (stat: CityStat) =>
    Math.min(
      weightedEdge(stat.rank, stat.count),
      stat.changeRank === null ? Infinity : weightedEdge(stat.changeRank, stat.changeCount),
    ) -
    Math.min(Math.abs(stat.change ?? 0), 1) +
    METRICS.indexOf(stat.metric) * 0.15;
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
  return years.map((year) => median(cities.flatMap((city) => city.perCapita[item]?.[year] ?? [])));
}

export function cityLabel(city: LargeCity, cities: LargeCity[]): string {
  return cities.some((other) => other !== city && other.name === city.name)
    ? `${city.name} (${city.departmentCode})`
    : city.name;
}

export function leadsWithChange(stat: CityStat): boolean {
  return (
    stat.changeRank !== null &&
    edge(stat.changeRank, stat.changeCount) < edge(stat.rank, stat.count)
  );
}

export function statSentence(stat: CityStat, city: string, first = true): string {
  if (leadsWithChange(stat) && stat.first !== null && stat.change !== null) {
    return `${first ? city : "Elle"} est passée de ${formatEuro(stat.first)} à ${formatEuro(stat.last)} ${stat.metric.of} par habitant entre ${FIRST_YEAR} et ${LAST_YEAR} (${formatChange(stat.change)}), la ${changeRankText(stat.changeRank!, stat.changeCount)}.`;
  }
  return `${first ? `En ${LAST_YEAR}, ${city} compte` : "Elle compte aussi"} ${formatEuro(stat.last)} ${stat.metric.of} par habitant, le ${rankText(stat.rank, stat.count)}.`;
}
