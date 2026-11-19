import { isHiddenInScene, sceneSeatCount } from "@prism/floorplan-scene";
import type { FloorplanSceneDocument, PrismFloorplanSeatingGuest } from "@prism/types";

export type FooterCounts = { guests: number; seats: number; seated: number };
export type RoomSize = { width: number; depth: number };

type Node = FloorplanSceneDocument["nodes"][string] & Record<string, unknown>;

const visibleNodes = (scene: FloorplanSceneDocument, type: string) =>
  Object.values(scene.nodes as Record<string, Node>).filter((node) => node.type === type && !isHiddenInScene(scene, node.id));

/**
 * The footer's numbers: guests who have not declined (the event's guest count while the roster is empty), seats at
 * visible tables and seating blocks, and the distinct guests seated at visible tables.
 */
export function footerCounts(scene: FloorplanSceneDocument, guests: readonly PrismFloorplanSeatingGuest[], guestCount: number): FooterCounts {
  const attending = guests.filter((guest) => guest.rsvp !== "declined").length;
  const seated = new Set(
    visibleNodes(scene, "prism-table").flatMap((table) => (Array.isArray(table.guestIds) ? (table.guestIds as unknown[]) : [])),
  );
  return { guests: guests.length === 0 ? guestCount : attending, seats: sceneSeatCount(scene), seated: seated.size };
}

const isPoint = (value: unknown): value is [number, number] =>
  Array.isArray(value) && typeof value[0] === "number" && typeof value[1] === "number";

/** The extent of the visible walls in metres, or null for a plan without walls. */
export function roomSize(scene: FloorplanSceneDocument): RoomSize | null {
  const points = visibleNodes(scene, "wall").flatMap((wall) => [wall.start, wall.end].filter(isPoint));
  if (points.length === 0) return null;
  const xs = points.map(([x]) => x);
  const zs = points.map(([, z]) => z);
  return { width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...zs) - Math.min(...zs) };
}
