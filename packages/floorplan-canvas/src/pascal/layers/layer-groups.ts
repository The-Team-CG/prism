import type { FloorplanSceneDocument } from "@prism/types";

export type LayerGroupId = "venue" | "tables" | "seating" | "stage-floor" | "food-bar" | "zones" | "other";
export type LayerGroup = { id: LayerGroupId; label: string; nodeIds: string[] };

const GROUPS: ReadonlyArray<{ id: LayerGroupId; label: string; types: readonly string[] }> = [
  { id: "venue", label: "Venue", types: ["wall", "column"] },
  { id: "tables", label: "Tables", types: ["prism-table"] },
  { id: "seating", label: "Seating", types: ["prism-seating-block", "prism-seat"] },
  { id: "stage-floor", label: "Stage & floor", types: ["prism-stage", "prism-dance-floor", "prism-av", "prism-registration", "prism-booth"] },
  { id: "food-bar", label: "Food & bar", types: ["prism-catering", "prism-bar"] },
  { id: "zones", label: "Zones", types: ["prism-zone"] },
  { id: "other", label: "Other", types: ["prism-decor", "prism-safety", "prism-fixture", "prism-shape"] },
];

/** The Layers list: the room's walls and columns, then each family of event pieces, leaving out empty groups. */
export function layerGroups(scene: FloorplanSceneDocument): LayerGroup[] {
  // Tables list in number order, so T2 sits between T1 and T3 whatever order they were placed in.
  const tableNumber = (node: (typeof scene.nodes)[string]) => (typeof node.number === "number" ? node.number : Number.MAX_SAFE_INTEGER);
  const nodes = Object.values(scene.nodes).sort((a, b) => tableNumber(a) - tableNumber(b));
  return GROUPS.map(({ id, label, types }) => ({ id, label, nodeIds: nodes.filter((node) => types.includes(node.type)).map((node) => node.id) })).filter(
    (group) => group.nodeIds.length > 0,
  );
}

/** A seated table stays visible: hiding it would leave its guests at a table nobody can see. */
export function hideRefusal(node: { type: string; guestIds?: unknown }): string | null {
  return node.type === "prism-table" && Array.isArray(node.guestIds) && node.guestIds.length > 0 ? "Unseat guests to hide this table" : null;
}
