import type { FloorplanSceneDocument } from "@prism/types";
import { isHiddenInScene } from "./scene-visibility.js";

export type SceneTableAssignment = { tableId: string; seats: number; hidden: boolean; guestIds: string[] };

/** Every table in a validated scene with its seat count and seated guest IDs, for the seating rules. */
export function tableAssignmentsOf(scene: FloorplanSceneDocument): SceneTableAssignment[] {
  return Object.values(scene.nodes)
    .filter((node) => node.type === "prism-table")
    .map((node) => {
      const table = node as { seats?: unknown; guestIds?: unknown };
      return {
        tableId: node.id,
        seats: typeof table.seats === "number" ? table.seats : 0,
        hidden: isHiddenInScene(scene, node.id),
        guestIds: Array.isArray(table.guestIds) ? table.guestIds.filter((id): id is string => typeof id === "string") : [],
      };
    });
}

/**
 * The layout without anything that belongs to one event: tables lose their seated guests (the event's roster) and
 * supplier zones lose their suppliers (the event's bookings). A venue template, a draft made from one and a client's
 * copy of the official layout all start from this, so none of them names guests or suppliers of another event.
 */
export function withoutEventAssignments(scene: FloorplanSceneDocument): FloorplanSceneDocument {
  const nodes = Object.fromEntries(
    Object.entries(scene.nodes).map(([id, node]) => [
      id,
      node.type === "prism-table" ? { ...node, guestIds: [] } : node.type === "prism-zone" ? { ...node, supplierIds: [] } : node,
    ]),
  );
  return { ...scene, nodes } as FloorplanSceneDocument;
}

/** The scene with every table's seated guests removed: seats belong to one event's roster, so a copied layout starts empty. */
export function withoutSeatedGuests(scene: FloorplanSceneDocument): FloorplanSceneDocument {
  const nodes = Object.fromEntries(
    Object.entries(scene.nodes).map(([id, node]) => [id, node.type === "prism-table" ? { ...node, guestIds: [] } : node]),
  );
  return { ...scene, nodes } as FloorplanSceneDocument;
}
