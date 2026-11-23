import type { LargeCity } from "./data";
import { formatChange, formatEuro } from "./format.ts";
import {
  FIRST_YEAR,
  LAST_YEAR,
  cityLabel,
  cityStats,
  headline,
  leadsWithChange,
  medianByYear,
  standoutStats,
  type CityStat,
} from "./large-cities.ts";
import { BLUE, MUTED, NAVY, box, logoUrl, renderPng, type Node } from "./share-card";

export const SLIDES = 3;
const WIDTH = 1080;
const HEIGHT = 1350;
const CHART = { width: 952, height: 560 };
const GREY = "#c7cdd8";
const ROWS = 8;

const svgImage = (svg: string, width: number, height: number): Node => ({
  type: "img",
  props: { src: `data:image/svg+xml;base64,${btoa(svg)}`, width, height },
});

function ranking(cities: LargeCity[], city: LargeCity, stat: CityStat): Node {
  const high = stat.rank <= stat.count / 2;
  const values = cities
    .flatMap((other) => {
      const value = other.perCapita[stat.metric.item]?.[LAST_YEAR];
      return value === undefined ? [] : [{ other, value }];
    })
    .toSorted((a, b) => (high ? b.value - a.value : a.value - b.value));
  const rows = values.slice(0, ROWS);
  if (!rows.some((row) => row.other === city)) {
    rows[ROWS - 1] = values.find((row) => row.other === city)!;
  }
  const max = Math.max(...rows.map((row) => row.value), 1);
  return box(
    { display: "flex", flexDirection: "column", gap: 14, width: "100%" },
    rows.map(({ other, value }) => {
      const current = other === city;
      return box({ display: "flex", alignItems: "center", gap: 18, height: 52 }, [
        box(
          {
            width: 300,
            justifyContent: "flex-end",
            textAlign: "right",
            fontSize: 28,
            fontWeight: current ? 800 : 400,
            color: current ? NAVY : MUTED,
          },
          cityLabel(other, cities),
        ),
        box({ display: "flex", alignItems: "center", flexGrow: 1, gap: 14 }, [
          box({
            width: `${Math.max((value / max) * 78, 0.5)}%`,
            height: 40,
            borderRadius: 8,
            background: current ? BLUE : GREY,
          }),
          box(
            { fontSize: 28, fontWeight: current ? 800 : 400, color: current ? NAVY : MUTED },
            formatEuro(value),
          ),
        ]),
      ]);
    }),
  );
}

function trend(cities: LargeCity[], city: LargeCity, stat: CityStat): Node {
  const years = Object.keys(city.perCapita[stat.metric.item] ?? {}).map(Number);
  const own = years.map((year) => city.perCapita[stat.metric.item]![year]!);
  const typical = medianByYear(cities, stat.metric.item, years);
  const max = Math.max(...own, ...typical) * 1.1;
  const { width, height } = CHART;
  const x = (index: number) => 24 + (index / Math.max(years.length - 1, 1)) * (width - 48);
  const y = (value: number) => height - 16 - (value / max) * (height - 40);
  const line = (values: number[], style: string) =>
    `<polyline points="${values.map((value, index) => `${x(index)},${y(value)}`).join(" ")}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${style}/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><line x1="0" x2="${width}" y1="${height - 16}" y2="${height - 16}" stroke="${GREY}" stroke-width="2"/>${line(typical, `stroke="${GREY}" stroke-width="8" stroke-dasharray="4 18"`)}${line(own, `stroke="${BLUE}" stroke-width="12"`)}<circle cx="${x(own.length - 1)}" cy="${y(own.at(-1)!)}" r="16" fill="${BLUE}"/></svg>`;
  return box({ display: "flex", flexDirection: "column", width: "100%" }, [
    box({ display: "flex", gap: 36, fontSize: 26, color: MUTED, marginBottom: 12 }, [
      box({ display: "flex", alignItems: "center", gap: 12 }, [
        box({ width: 36, height: 10, borderRadius: 5, background: BLUE }),
        cityLabel(city, cities),
      ]),
      box({ display: "flex", alignItems: "center", gap: 12 }, [
        box({ width: 36, height: 10, borderRadius: 5, background: GREY }),
        "Grande ville médiane",
      ]),
    ]),
    svgImage(svg, width, height),
    box({ display: "flex", justifyContent: "space-between", fontSize: 26, color: MUTED }, [
      box({}, String(years[0])),
      box({}, String(years.at(-1))),
    ]),
  ]);
}

function figures(stat: CityStat): { value: string; label: string }[] {
  if (leadsWithChange(stat) && stat.first !== null && stat.changeRank !== null) {
    const rise = stat.changeRank <= stat.changeCount / 2;
    const position = rise ? stat.changeRank : stat.changeCount + 1 - stat.changeRank;
    return [
      { value: formatEuro(stat.first), label: `par habitant en ${FIRST_YEAR}` },
      { value: formatEuro(stat.last), label: `en ${LAST_YEAR}` },
      {
        value: position === 1 ? "1re" : `${position}e`,
        label: `plus forte ${rise ? "hausse" : "baisse"} sur ${stat.changeCount}`,
      },
    ];
  }
  return [
    { value: formatEuro(stat.last), label: `par habitant en ${LAST_YEAR}` },
    { value: formatEuro(stat.median), label: "grande ville médiane" },
    ...(stat.change === null
      ? []
      : [{ value: formatChange(stat.change), label: `depuis ${FIRST_YEAR}` }]),
  ];
}

function slide(cities: LargeCity[], city: LargeCity, stat: CityStat, page: string): Node {
  const name = cityLabel(city, cities);
  const title = headline(stat, name);
  return box(
    {
      display: "flex",
      flexDirection: "column",
      width: WIDTH,
      height: HEIGHT,
      padding: "64px 64px 48px",
      background: "#ffffff",
      fontFamily: "Inter",
      color: NAVY,
    },
    [
      box({ display: "flex", justifyContent: "space-between", fontSize: 26, fontWeight: 800 }, [
        box({ color: BLUE }, `${name.toUpperCase()} · COMPTES ${FIRST_YEAR}-${LAST_YEAR}`),
        box({ color: MUTED }, page),
      ]),
      box(
        {
          marginTop: 24,
          fontSize: title.length > 80 ? 54 : 62,
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: -1.5,
        },
        title,
      ),
      box(
        { display: "flex", alignItems: "center", flexGrow: 1, marginTop: 36 },
        leadsWithChange(stat) ? trend(cities, city, stat) : ranking(cities, city, stat),
      ),
      box(
        { display: "flex", gap: 40, marginTop: 28 },
        figures(stat).map((figure) =>
          box({ display: "flex", flexDirection: "column", flex: 1 }, [
            box({ fontSize: 56, fontWeight: 800, letterSpacing: -1.5 }, figure.value),
            box({ fontSize: 24, color: MUTED }, figure.label),
          ]),
        ),
      ),
      box(
        {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 36,
          paddingTop: 28,
          borderTop: "2px solid #e1e5ec",
        },
        [
          box({ fontSize: 22, color: MUTED }, "Source : OFGL, comptes des communes"),
          box({ display: "flex", alignItems: "center", gap: 14 }, [
            { type: "img", props: { src: logoUrl, width: 56, height: 56 } },
            box({ fontSize: 32, fontWeight: 800, letterSpacing: -0.5 }, "chaqueeuro.fr"),
          ]),
        ],
      ),
    ],
  );
}

export function renderCitySlide(
  cities: LargeCity[],
  city: LargeCity,
  index: number,
): Promise<Uint8Array<ArrayBuffer>> | null {
  const stats = standoutStats(cityStats(cities, city), SLIDES);
  const stat = stats[index - 1];
  return stat
    ? renderPng(slide(cities, city, stat, `${index}/${stats.length}`), WIDTH, HEIGHT)
    : null;
}
