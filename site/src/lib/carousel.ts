import type { LargeCity, getPropertyTaxMap, getPropertyTaxSummary } from "./data";
import { formatChange, formatEuro, formatNumber, formatPercent } from "./format.ts";
import {
  FIRST_YEAR,
  LAST_YEAR,
  atCity,
  baseGrowth,
  changePosition,
  cityLabel,
  cityStats,
  firstYear,
  formatValue,
  headline,
  leadsWithChange,
  median,
  medianByYear,
  standoutStats,
  valueNote,
  type CityStat,
} from "./large-cities.ts";
import { BLUE, MUTED, NAVY, box, logoUrl, renderPng, type Node } from "./share-card";

export const SLIDES = 3;
export const TAX_SLIDES = 5;
const WIDTH = 1080;
const HEIGHT = 1350;
const CHART = { width: 952, height: 560 };
const MAP_HEIGHT = 690;
const GREY = "#c7cdd8";
const ROWS = 8;

interface Figure {
  value: string;
  label: string;
}

interface Bar {
  label: string;
  value: number;
  display: string;
  highlight?: boolean;
}

interface Legend {
  label: string;
  color: string;
}

const svgImage = (svg: string, width: number, height: number): Node => ({
  type: "img",
  props: { src: `data:image/svg+xml;base64,${btoa(svg)}`, width, height },
});

function frame(slide: {
  kicker: string;
  page: string;
  title: string;
  chart: Node;
  figures: Figure[];
  source: string;
}): Node {
  return box(
    {
      display: "flex",
      flexDirection: "column",
      width: WIDTH,
      height: HEIGHT,
      padding: "60px 64px 44px",
      background: "#ffffff",
      fontFamily: "Inter",
      color: NAVY,
    },
    [
      box({ display: "flex", justifyContent: "space-between", fontSize: 26, fontWeight: 800 }, [
        box({ color: BLUE }, slide.kicker),
        box({ color: MUTED }, slide.page),
      ]),
      box(
        {
          marginTop: 22,
          fontSize: slide.title.length > 80 ? 52 : 60,
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: -1.5,
        },
        slide.title,
      ),
      box(
        { display: "flex", alignItems: "center", justifyContent: "center", flexGrow: 1 },
        slide.chart,
      ),
      box(
        { display: "flex", gap: 40, marginTop: 24 },
        slide.figures.map((figure) =>
          box({ display: "flex", flexDirection: "column", flex: 1 }, [
            box({ fontSize: 54, fontWeight: 800, letterSpacing: -1.5 }, figure.value),
            box({ fontSize: 24, color: MUTED }, figure.label),
          ]),
        ),
      ),
      box(
        {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          marginTop: 30,
          paddingTop: 24,
          borderTop: "2px solid #e1e5ec",
        },
        [
          box({ fontSize: 21, color: MUTED, flexShrink: 1 }, slide.source),
          box({ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }, [
            { type: "img", props: { src: logoUrl, width: 56, height: 56 } },
            box({ fontSize: 32, fontWeight: 800, letterSpacing: -0.5 }, "chaqueeuro.fr"),
          ]),
        ],
      ),
    ],
  );
}

function bars(rows: (Bar | null)[], caption?: string): Node {
  const max = Math.max(...rows.map((row) => row?.value ?? 0), 1);
  return box({ display: "flex", flexDirection: "column", gap: 14, width: "100%" }, [
    ...(caption ? [box({ fontSize: 26, color: MUTED, marginBottom: 6 }, caption)] : []),
    ...rows.map((row) =>
      row
        ? box({ display: "flex", alignItems: "center", gap: 18, height: 50 }, [
            box(
              {
                width: 310,
                flexShrink: 0,
                justifyContent: "flex-end",
                textAlign: "right",
                fontSize: 28,
                fontWeight: row.highlight ? 800 : 400,
                color: row.highlight ? NAVY : MUTED,
              },
              row.label,
            ),
            box({ display: "flex", alignItems: "center", flexGrow: 1, gap: 14 }, [
              box({
                width: `${Math.max((row.value / max) * 62, 0.5)}%`,
                height: 40,
                borderRadius: 8,
                background: row.highlight ? BLUE : GREY,
              }),
              box(
                {
                  fontSize: 28,
                  fontWeight: row.highlight ? 800 : 400,
                  color: row.highlight ? NAVY : MUTED,
                },
                row.display,
              ),
            ]),
          ])
        : box({ display: "flex", justifyContent: "center", fontSize: 28, color: MUTED }, "…"),
    ),
  ]);
}

function legend(entries: Legend[]): Node {
  return box(
    {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: "8px 18px",
      fontSize: 22,
      color: MUTED,
    },
    entries.map((entry) =>
      box({ display: "flex", alignItems: "center", gap: 8 }, [
        box({ width: 26, height: 18, borderRadius: 4, background: entry.color }),
        entry.label,
      ]),
    ),
  );
}

function ranking(cities: LargeCity[], city: LargeCity, stat: CityStat): Node {
  const high = stat.rank <= stat.count / 2;
  const values = cities
    .flatMap((other) => {
      const value = other.values[stat.metric.item]?.[LAST_YEAR];
      return value === undefined ? [] : [{ other, value }];
    })
    .toSorted((a, b) => (high ? b.value - a.value : a.value - b.value));
  const rows = values.slice(0, ROWS);
  if (!rows.some((row) => row.other === city)) {
    rows[ROWS - 1] = values.find((row) => row.other === city)!;
  }
  return bars(
    rows.map(({ other, value }) => ({
      label: cityLabel(other, cities),
      value,
      display: formatValue(stat.metric, value),
      highlight: other === city,
    })),
  );
}

function trend(cities: LargeCity[], city: LargeCity, stat: CityStat): Node {
  const years = Object.keys(city.values[stat.metric.item] ?? {}).map(Number);
  const own = years.map((year) => city.values[stat.metric.item]![year]!);
  const typical = medianByYear(cities, stat.metric.item, years);
  const max = Math.max(...own, ...typical) * 1.1;
  const { width, height } = CHART;
  const x = (index: number) => 24 + (index / Math.max(years.length - 1, 1)) * (width - 48);
  const y = (value: number) => height - 16 - (value / max) * (height - 40);
  const line = (values: number[], style: string) =>
    `<polyline points="${values.map((value, index) => `${x(index)},${y(value)}`).join(" ")}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${style}/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><line x1="0" x2="${width}" y1="${height - 16}" y2="${height - 16}" stroke="${GREY}" stroke-width="2"/>${line(typical, `stroke="${GREY}" stroke-width="8" stroke-dasharray="4 18"`)}${line(own, `stroke="${BLUE}" stroke-width="12"`)}<circle cx="${x(own.length - 1)}" cy="${y(own.at(-1)!)}" r="16" fill="${BLUE}"/></svg>`;
  return box({ display: "flex", flexDirection: "column", width: "100%" }, [
    legendLine([
      { label: cityLabel(city, cities), color: BLUE },
      { label: "Grande ville médiane", color: GREY },
    ]),
    svgImage(svg, width, height),
    box({ display: "flex", justifyContent: "space-between", fontSize: 26, color: MUTED }, [
      box({}, String(years[0])),
      box({}, String(years.at(-1))),
    ]),
  ]);
}

function legendLine(entries: Legend[]): Node {
  return box(
    { display: "flex", gap: 36, fontSize: 26, color: MUTED, marginBottom: 12 },
    entries.map((entry) =>
      box({ display: "flex", alignItems: "center", gap: 12 }, [
        box({ width: 36, height: 10, borderRadius: 5, background: entry.color }),
        entry.label,
      ]),
    ),
  );
}

function cityFigures(stat: CityStat): Figure[] {
  if (
    leadsWithChange(stat) &&
    stat.first !== null &&
    stat.changeRank !== null &&
    stat.change !== null
  ) {
    const { position, label } = changePosition(stat.changeRank, stat.changeCount, stat.change);
    return [
      {
        value: formatValue(stat.metric, stat.first),
        label: valueNote(stat.metric, firstYear(stat.metric)),
      },
      { value: formatValue(stat.metric, stat.last), label: `en ${LAST_YEAR}` },
      {
        value: position === 1 ? "1re" : `${position}e`,
        label: `${label} sur ${stat.changeCount}`,
      },
    ];
  }
  return [
    { value: formatValue(stat.metric, stat.last), label: valueNote(stat.metric, LAST_YEAR) },
    { value: formatValue(stat.metric, stat.median), label: "grande ville médiane" },
    ...(stat.change === null
      ? []
      : [{ value: formatChange(stat.change), label: `depuis ${firstYear(stat.metric)}` }]),
  ];
}

export function renderCitySlide(
  cities: LargeCity[],
  city: LargeCity,
  index: number,
): Promise<Uint8Array<ArrayBuffer>> | null {
  const stats = standoutStats(cityStats(cities, city), SLIDES);
  const stat = stats[index - 1];
  if (!stat) return null;
  const name = cityLabel(city, cities);
  return renderPng(
    frame({
      kicker: `${name.toUpperCase()} · COMPTES ${FIRST_YEAR}-${LAST_YEAR}`,
      page: `${index}/${stats.length}`,
      title: headline(stat, name),
      chart: leadsWithChange(stat) ? trend(cities, city, stat) : ranking(cities, city, stat),
      figures: cityFigures(stat),
      source: stat.metric.rate
        ? "Source : DGFiP, taux de taxe foncière 2021-2025"
        : "Source : OFGL, comptes des communes",
    }),
    WIDTH,
    HEIGHT,
  );
}

const RATE_CLASSES = [
  { below: 25, color: "#e3eefb", label: "moins de 25 %" },
  { below: 35, color: "#9cc3f0", label: "25 à 35 %" },
  { below: 45, color: "#4f93e0", label: "35 à 45 %" },
  { below: 55, color: "#1c5cab", label: "45 à 55 %" },
  { below: Infinity, color: "#0b2a55", label: "55 % et plus" },
];

const NO_DATA = "#f1f2f4";

function franceMap(
  map: Awaited<ReturnType<typeof getPropertyTaxMap>>,
  fill: (area: (typeof map.areas)[number]) => string,
): Node {
  const [left, top, width, height] = map.viewBox;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${width} ${height}">${map.areas.map((area) => `<path d="${area.path}" fill="${fill(area)}"/>`).join("")}</svg>`;
  return svgImage(svg, Math.round((MAP_HEIGHT * width) / height), MAP_HEIGHT);
}

export function renderTaxSlide(
  index: number,
  map: Awaited<ReturnType<typeof getPropertyTaxMap>>,
  summary: Awaited<ReturnType<typeof getPropertyTaxSummary>>,
  cities: LargeCity[],
): Promise<Uint8Array<ArrayBuffer>> | null {
  const { firstYear: start, lastYear: end, revaluation } = summary;
  const rate = (value: number) => formatPercent(value / 100, 1);
  const base = baseGrowth(revaluation, start, end);
  const rates = cities
    .flatMap((city) => {
      const from = city.values.taxe_fonciere?.[start];
      const to = city.values.taxe_fonciere?.[end];
      return to === undefined ? [] : [{ name: cityLabel(city, cities), from, to }];
    })
    .toSorted((a, b) => b.to - a.to);
  const highest = rates[0]!;
  const lowest = rates.at(-1)!;
  const typical = median(rates.map((city) => city.to));
  const bills = rates
    .flatMap((city) => (city.from ? [{ ...city, bill: (city.to / city.from) * base - 1 }] : []))
    .toSorted((a, b) => b.bill - a.bill);
  const top = bills[0]!;
  const paris = rates.find((city) => city.name === "Paris");
  const years = Object.keys(revaluation)
    .map(Number)
    .filter((year) => year > start && year <= end);
  const peak = years.toSorted((a, b) => revaluation[b]! - revaluation[a]!)[0]!;
  const communeBills = map.areas.flatMap((area) =>
    area.previous ? [(area.rate / area.previous) * base - 1] : [],
  );
  const over = (threshold: number) => communeBills.filter((bill) => bill >= threshold).length;
  const unchanged = base - 1;
  const billClasses = [
    {
      below: unchanged - 0.005,
      color: "#6da7ec",
      label: `taux baissé : moins de ${formatChange(unchanged)}`,
    },
    {
      below: unchanged + 0.005,
      color: "#e2e0db",
      label: `taux inchangé : ${formatChange(unchanged)}`,
    },
    { below: 0.25, color: "#f6c3a5", label: `+${Math.round(unchanged * 100)} à 25 %` },
    { below: 0.4, color: "#ef8f63", label: "+25 à 40 %" },
    { below: Infinity, color: "#b8441a", label: "+40 % et plus" },
  ];
  const kicker = `FRANCE · TAXE FONCIÈRE ${end}`;
  const page = `${index}/${TAX_SLIDES}`;
  const source = `Source : DGFiP, taux nets commune et intercommunalité ${start}-${end}`;
  const revaluationSource = `Insee, indice des prix harmonisé de novembre (article 1518 bis du CGI)`;
  const slides = [
    () =>
      frame({
        kicker,
        page,
        title: `${top.name} : la taxe foncière d’un même logement a pris ${formatChange(top.bill)} depuis ${start}`,
        chart: bars(
          bills.slice(0, ROWS).map((city, at) => ({
            label: city.name,
            value: Math.max(city.bill, 0) * 100,
            display: formatChange(city.bill),
            highlight: at === 0,
          })),
          `Hausse de la taxe pour un même logement, ${start}-${end}`,
        ),
        figures: [
          { value: formatChange(top.bill), label: atCity(top.name) },
          { value: formatChange(unchanged), label: "sans aucune hausse du taux" },
          {
            value: formatChange(median(bills.map((city) => city.bill))),
            label: "grande ville médiane",
          },
        ],
        source: `${source} ; ${revaluationSource}. Communes d’au moins 100 000 habitants.`,
      }),
    () =>
      frame({
        kicker,
        page,
        title: `Même là où le taux n’a pas bougé, la taxe a pris ${formatChange(unchanged)} depuis ${start}`,
        chart: bars(
          years.map((year) => ({
            label: String(year),
            value: (revaluation[year]! - 1) * 100,
            display: `+${formatPercent(revaluation[year]! - 1, 1)}`,
            highlight: year === peak,
          })),
          "Hausse légale des valeurs locatives des logements, chaque année",
        ),
        figures: [
          { value: formatChange(unchanged), label: `cumulé depuis ${start}` },
          { value: `+${formatPercent(revaluation[peak]! - 1, 1)}`, label: `en ${peak}` },
          {
            value: formatNumber(summary.communes - summary.raised - summary.lowered),
            label: "communes sans hausse du taux",
          },
        ],
        source: `Source : ${revaluationSource}. La valeur suit l’inflation, sans vote local.`,
      }),
    () =>
      frame({
        kicker,
        page,
        title: `Dans ${formatPercent(over(0.2) / communeBills.length)} des communes, la taxe d’un même logement a pris plus de 20 % depuis ${start}`,
        chart: box({ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }, [
          franceMap(map, (area) =>
            area.previous
              ? billClasses.find((entry) => (area.rate / area.previous!) * base - 1 < entry.below)!
                  .color
              : NO_DATA,
          ),
          legend(billClasses),
        ]),
        figures: [
          { value: formatChange(median(communeBills)), label: "commune médiane" },
          { value: formatNumber(over(0.25)), label: "communes à +25 % ou plus" },
          { value: formatNumber(over(0.4)), label: "communes à +40 % ou plus" },
        ],
        source: `${source} ; ${revaluationSource}. France métropolitaine.`,
      }),
    () =>
      frame({
        kicker,
        page,
        title: `À valeur locative égale, la taxe foncière est ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(highest.to / lowest.to)} fois plus élevée ${atCity(highest.name)} qu’${atCity(lowest.name)}`,
        chart: bars(
          [
            { label: highest.name, value: highest.to, display: formatEuro(highest.to * 10) },
            { label: "Grande ville médiane", value: typical, display: formatEuro(typical * 10) },
            ...(paris && paris !== highest && paris !== lowest
              ? [{ label: "Paris", value: paris.to, display: formatEuro(paris.to * 10) }]
              : []),
            { label: lowest.name, value: lowest.to, display: formatEuro(lowest.to * 10) },
          ].map((row, at, all) => ({ ...row, highlight: at === 0 || at === all.length - 1 })),
          `Taxe pour 1 000 € de base imposable en ${end}`,
        ),
        figures: [
          { value: rate(highest.to), label: atCity(highest.name) },
          { value: rate(lowest.to), label: atCity(lowest.name) },
        ],
        source:
          "Source : DGFiP. Le montant payé dépend aussi de la valeur locative de chaque logement.",
      }),
    () =>
      frame({
        kicker,
        page,
        title: "Retrouvez le taux de votre commune sur chaqueeuro.fr",
        chart: box({ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }, [
          franceMap(map, (area) => RATE_CLASSES.find((entry) => area.rate < entry.below)!.color),
          legend(RATE_CLASSES),
        ]),
        figures: [
          { value: rate(summary.median), label: `taux médian en ${end}` },
          { value: rate(highest.to), label: atCity(highest.name) },
          { value: rate(lowest.to), label: atCity(lowest.name) },
        ],
        source: `${source}, France métropolitaine`,
      }),
  ];
  const slide = slides[index - 1];
  return slide ? renderPng(slide(), WIDTH, HEIGHT) : null;
}
