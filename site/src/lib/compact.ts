import type { Source, SourceCitation } from "./data";

const MAP_DRAWING = new Set([
  "path",
  "geometry",
  "viewBox",
  "franceViewBox",
  "outline",
  "labelX",
  "labelY",
  "labelSize",
  "cx",
  "cy",
]);

type SourceSummary = Pick<
  Source,
  | "id"
  | "shortName"
  | "name"
  | "publisher"
  | "pageUrl"
  | "fileUrl"
  | "licence"
  | "dataDate"
  | "coverage"
>;

function isCitation(value: unknown): value is SourceCitation {
  return (
    typeof value === "object" &&
    value !== null &&
    "recordUrl" in value &&
    "source" in value &&
    typeof value.source === "object" &&
    value.source !== null
  );
}

function round(value: number): number {
  return Number(value.toPrecision(Math.max(6, Math.ceil(Math.log10(Math.abs(value))) + 2)));
}

export function compact(data: object): Record<string, unknown> {
  const sources: Record<string, SourceSummary> = {};
  const json = JSON.stringify(data, (key, value: unknown) => {
    if (MAP_DRAWING.has(key)) return undefined;
    if (typeof value === "number" && !Number.isInteger(value)) return round(value);
    if (!isCitation(value)) return value;
    const { id, shortName, name, publisher, pageUrl, fileUrl, licence, dataDate, coverage } =
      value.source;
    sources[id] = { id, shortName, name, publisher, pageUrl, fileUrl, licence, dataDate, coverage };
    return { source: id, recordUrl: value.recordUrl, dataDate };
  });
  return { ...(JSON.parse(json) as Record<string, unknown>), sources };
}
