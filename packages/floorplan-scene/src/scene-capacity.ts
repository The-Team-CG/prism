import type { FloorplanSceneDocument } from "@prism/types";
import { isHiddenInScene } from "./scene-visibility.js";

type Node = FloorplanSceneDocument["nodes"][string] & Record<string, unknown>;

const numberOr = (value: unknown, fallback: number) => (typeof value === "number" ? value : fallback);

function seatsOf(node: Node): number {
  if (node.type === "prism-table") return numberOr(node.seats, 0);
  if (node.type === "prism-seating-block") return numberOr(node.rows, 0) * numberOr(node.columns, 0);
  return 0;
}

/** Seats in the room: every visible table's seats plus every visible seating block's rows × columns. */
export function sceneSeatCount(scene: FloorplanSceneDocument): number {
  return Object.values(scene.nodes as Record<string, Node>).reduce(
    (total, node) => total + (seatsOf(node) > 0 && !isHiddenInScene(scene, node.id) ? seatsOf(node) : 0),
    0,
  );
}

/** One past the highest table number in the scene, so a new table never repeats one. */
export function nextTableNumber(scene: FloorplanSceneDocument): number {
  const numbers = Object.values(scene.nodes as Record<string, Node>)
    .filter((node) => node.type === "prism-table" && typeof node.number === "number")
    .map((node) => node.number as number);
  return Math.max(0, ...numbers) + 1;
}

/** Every supplier named on a zone, once each, in the order first named. */
export function zoneSupplierIds(scene: FloorplanSceneDocument): string[] {
  const ids = Object.values(scene.nodes as Record<string, Node>)
    .filter((node) => node.type === "prism-zone" && Array.isArray(node.supplierIds))
    .flatMap((node) => (node.supplierIds as unknown[]).filter((id): id is string => typeof id === "string"));
  return [...new Set(ids)];
}
