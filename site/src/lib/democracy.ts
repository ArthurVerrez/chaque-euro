import { formatEuros, formatYear } from "./format";

export function declaredCosts(row: {
  cost_min: number | null;
  cost_max: number | null;
  cost_exact: number | null;
}): string {
  if (row.cost_exact !== null) return formatEuros(row.cost_exact);
  if (row.cost_max !== null && row.cost_min !== null)
    return `${formatEuros(row.cost_min)} à ${formatEuros(row.cost_max)}`;
  if (row.cost_max !== null) return `Jusqu’à ${formatEuros(row.cost_max)}`;
  if (row.cost_min !== null) return `Au moins ${formatEuros(row.cost_min)}`;
  return "Non déclaré";
}

export function exercisePeriod(startsOn: string | null, endsOn: string | null): string {
  if (!startsOn || !endsOn) return "Aucun exercice clos publié";
  const start = startsOn.slice(0, 4);
  const end = endsOn.slice(0, 4);
  return start === end ? `Exercice ${formatYear(end)}` : `Exercice ${start} à ${end}`;
}

export const roleLabels: Record<string, string> = {
  deputy: "Député ou députée",
  senator: "Sénateur ou sénatrice",
  minister: "Membre du gouvernement",
  former: "Ancien mandat",
};
export const positionLabels: Record<string, string> = {
  pour: "Pour",
  contre: "Contre",
  abstention: "Abstention",
  "non-votant": "Non-votant",
};
export const electionLabels: Record<string, string> = {
  "legislatives-2024": "Législatives 2024",
  "europeennes-2024": "Européennes 2024",
};
export const registerLabels: Record<string, string> = {
  ca: "Conseillers d’arrondissement",
  cm: "Conseillers municipaux",
  epci: "Conseillers communautaires",
  cd: "Conseillers départementaux",
  cr: "Conseillers régionaux",
  ma: "Membres d’assemblées",
  rpe: "Parlement européen",
  sen: "Sénateurs",
  dep: "Députés",
  mai: "Maires",
  consfde: "Conseillers des Français de l’étranger",
  afe: "Assemblée des Français de l’étranger",
};
export const pageNumber = (value: string | null): number =>
  Math.max(1, Math.min(100000, Math.trunc(Number(value) || 1)));
