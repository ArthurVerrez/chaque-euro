export type Position = [number, number];
type Polygon = Position[][];
export type ConstituencyGeometry =
  { type: "Polygon"; coordinates: Polygon } | { type: "MultiPolygon"; coordinates: Polygon[] };

export interface ConstituencyShape {
  constituency: number;
  geometry: ConstituencyGeometry;
}

export function communeCode(code: string): string {
  if (/^751\d{2}$/.test(code)) return "75056";
  if (/^6938[1-9]$/.test(code)) return "69123";
  if (/^132\d{2}$/.test(code)) return "13055";
  return code;
}

function insideRing([x, y]: Position, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function nearRing(point: Position, ring: Position[], metres: number): boolean {
  const sx = 111320 * Math.cos((point[1] * Math.PI) / 180);
  const sy = 111320;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = (ring[j]![0] - point[0]) * sx;
    const ay = (ring[j]![1] - point[1]) * sy;
    const dx = (ring[i]![0] - ring[j]![0]) * sx;
    const dy = (ring[i]![1] - ring[j]![1]) * sy;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length)) : 0;
    if (Math.hypot(ax + t * dx, ay + t * dy) <= metres) return true;
  }
  return false;
}

export function constituencyAt(point: Position, shapes: ConstituencyShape[]): number | null {
  if (!point.every(Number.isFinite)) return null;
  const matches = new Set<number>();
  for (const shape of shapes) {
    const polygons =
      shape.geometry.type === "Polygon" ? [shape.geometry.coordinates] : shape.geometry.coordinates;
    for (const polygon of polygons) {
      if (polygon.some((ring) => nearRing(point, ring, 200))) return null;
      if (
        polygon[0] &&
        insideRing(point, polygon[0]) &&
        !polygon.slice(1).some((ring) => insideRing(point, ring))
      ) {
        matches.add(shape.constituency);
      }
    }
  }
  return matches.size === 1 ? ([...matches][0] ?? null) : null;
}

export function addressConstituency(
  point: Position,
  deputies: { constituency: number }[],
  shapes: ConstituencyShape[],
): number | null {
  const numbers = new Set(deputies.map((deputy) => deputy.constituency));
  if (numbers.size < 2) return deputies[0]?.constituency ?? null;
  return numbers.size === new Set(shapes.map((shape) => shape.constituency)).size
    ? constituencyAt(point, shapes)
    : null;
}
