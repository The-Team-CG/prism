/**
 * Plan geometry for the layout checks: a piece's footprint as a convex polygon in plan metres (x across, z down the
 * plan), and the gaps and crossings between footprints and sight lines.
 */

export type Point = [number, number];
export type Footprint = Point[];

/** Where a point in a piece's own frame lands on the plan: turned by the piece's rotation, then moved to its position. */
export function onPlan(placement: { position: readonly number[]; rotation: number }, [x, z]: Point): Point {
  const [cos, sin] = [Math.cos(placement.rotation), Math.sin(placement.rotation)];
  return [placement.position[0]! + x * cos + z * sin, placement.position[2]! - x * sin + z * cos];
}

const ROUND_SIDES = 16;

/** A footprint `width` × `depth` about the piece's centre, grown by `reach` on every side; a circle when `round`. */
export function footprint(placement: { position: readonly number[]; rotation: number; width: number; depth: number }, round: boolean, reach = 0): Footprint {
  if (round) {
    const radius = Math.min(placement.width, placement.depth) / 2 + reach;
    return Array.from({ length: ROUND_SIDES }, (_, index) => {
      const angle = (2 * Math.PI * index) / ROUND_SIDES;
      return onPlan(placement, [radius * Math.cos(angle), radius * Math.sin(angle)]);
    });
  }
  const [w, d] = [placement.width / 2 + reach, placement.depth / 2 + reach];
  return ([[-w, -d], [w, -d], [w, d], [-w, d]] as Point[]).map((corner) => onPlan(placement, corner));
}

const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

export function contains(polygon: Footprint, point: Point): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [a, b] = [polygon[i]!, polygon[j]!];
    if (a[1] > point[1] !== b[1] > point[1] && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Whether segments pq and ab cross or touch. */
export function crosses(p: Point, q: Point, a: Point, b: Point): boolean {
  const [d1, d2, d3, d4] = [cross(a, b, p), cross(a, b, q), cross(p, q, a), cross(p, q, b)];
  return d1 * d2 <= 0 && d3 * d4 <= 0 && !(d1 === 0 && d2 === 0 && d3 === 0 && d4 === 0);
}

function pointToSegment(point: Point, a: Point, b: Point): number {
  const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
  const length = dx * dx + dz * dz;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / length));
  return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dz));
}

const edges = (polygon: Footprint): Array<[Point, Point]> => polygon.map((point, index) => [point, polygon[(index + 1) % polygon.length]!]);

/** The clear distance between two footprints; 0 when they touch or overlap. */
export function gapBetween(first: Footprint, second: Footprint): number {
  if (first.some((point) => contains(second, point)) || second.some((point) => contains(first, point))) return 0;
  let gap = Infinity;
  for (const [a, b] of edges(first)) {
    for (const [c, d] of edges(second)) {
      if (crosses(a, b, c, d)) return 0;
      gap = Math.min(gap, pointToSegment(a, c, d), pointToSegment(c, a, b));
    }
  }
  return gap;
}

/** Whether the sight line from `from` to `to` passes through a footprint. */
export function blocks(polygon: Footprint, from: Point, to: Point): boolean {
  return contains(polygon, from) || contains(polygon, to) || edges(polygon).some(([a, b]) => crosses(from, to, a, b));
}

/** The radius of the circle about `centre` that holds the whole footprint, for skipping pairs far apart. */
export const reachOf = (polygon: Footprint, centre: Point) => Math.max(...polygon.map(([x, z]) => Math.hypot(x - centre[0], z - centre[1])));
