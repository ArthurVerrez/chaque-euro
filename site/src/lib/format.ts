export const NBSP = "\u00a0";
const numberFormat = (digits: number) => {
  const format = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: "always",
  });
  return { format: (value: number) => format.format(value).replace(/\u202f/g, NBSP) };
};
const integer = numberFormat(0);
const oneDecimal = numberFormat(1);
const twoDecimals = numberFormat(2);
const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "Europe/Paris",
});
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});
const dayMonthFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});
const yearFormat = new Intl.DateTimeFormat("fr-FR", { year: "numeric", timeZone: "Europe/Paris" });

export function formatNumber(value: number): string {
  return integer.format(value);
}

export function formatEuro(value: number): string {
  return `${integer.format(value)}${NBSP}€`;
}

function scaled(value: number): string | null {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(abs >= 1e10 ? integer : oneDecimal).format(value / 1e9)}${NBSP}Md`;
  if (abs >= 1e6) return `${(abs >= 1e8 ? integer : oneDecimal).format(value / 1e6)}${NBSP}M`;
  return null;
}

export function formatEuros(value: number): string {
  const short = scaled(value);
  return short ? `${short}€` : formatEuro(value);
}

export function formatPercent(value: number, digits: 0 | 1 | 2 = 0): string {
  return `${(digits === 2 ? twoDecimals : digits === 1 ? oneDecimal : integer).format(value * 100)}${NBSP}%`;
}

export function medianGap(value: number | null, median: number | null): number | null {
  return value === null || !median ? null : value / median - 1;
}

export function formatGap(gap: number | null): string {
  if (gap === null) return "n.d.";
  if (Math.abs(gap) < 0.05) return "proche";
  return `${gap > 0 ? "+" : "−"}${formatPercent(Math.abs(gap))}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1_000_000) return `${formatNumber(Math.max(Math.round(bytes / 1000), 1))}${NBSP}ko`;
  const megabytes = bytes / 1_000_000;
  return `${(megabytes < 10 ? oneDecimal : integer).format(megabytes)}${NBSP}Mo`;
}

export function formatDate(value: string | null): string {
  if (!value) return "date inconnue";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

export function formatDateTime(value: string): string {
  return dateTimeFormat.format(new Date(value));
}

export function formatDayMonth(value: string): string {
  return dayMonthFormat.format(new Date(value)).replace(" ", NBSP);
}

export function formatYear(value: string): string {
  return yearFormat.format(new Date(value));
}

export function formatSiren(siren: string): string {
  return siren.replace(/(\d{3})(\d{3})(\d{3})/, `$1${NBSP}$2${NBSP}$3`);
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatNumber(count)}${NBSP}${count > 1 ? pluralForm : singular}`;
}

export function formatCompact(value: number): string {
  const short = scaled(value);
  if (short) return short;
  return Math.abs(value) >= 1e3 ? `${integer.format(value / 1e3)}${NBSP}k` : integer.format(value);
}

export function formatBillions(value: number): string {
  return `${oneDecimal.format(value / 1e9)}${NBSP}Md€`;
}

export function formatEuroCents(value: number): string {
  return `${twoDecimals.format(value / 100)}${NBSP}€`;
}
