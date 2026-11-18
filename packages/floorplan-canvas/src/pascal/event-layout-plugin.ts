import type { AnyNodeDefinition, FloorplanGeometry, NodeDefinition, Plugin } from "@pascal-app/core";
import { BoxGeometry, CylinderGeometry, Mesh, MeshStandardMaterial } from "three";
import {
  prismPieceNodeSchema,
  prismTableNodeSchema,
  type PrismPieceNode,
  type PrismPieceNodeType,
  type PrismTableNode,
} from "@prism/types";

export const PRISM_EVENT_LAYOUT_PLUGIN_ID = "prism:event-layout";

type EventPiece = PrismTableNode | PrismPieceNode;
type EventPieceType = EventPiece["type"];

/** Placeholder height until milestone 2 draws each piece: a table top's height. */
const PLACEHOLDER_HEIGHT_M = 0.75;
const PLACEHOLDER_COLOR = "#c9b8d6";
const FOOTPRINT_STYLE = { fill: "#f4eef8", stroke: "#6b4c80", strokeWidth: 0.02, pointerEvents: "all" } as const;

const LABELS: Record<EventPieceType, string> = {
  "prism-table": "Table",
  "prism-seat": "Seat",
  "prism-stage": "Stage",
  "prism-av": "Audio-visual",
  "prism-catering": "Catering",
  "prism-registration": "Registration",
  "prism-booth": "Booth",
  "prism-decor": "Decor",
  "prism-safety": "Safety",
  "prism-fixture": "Fixture",
  "prism-shape": "Shape",
};

function isRound(node: EventPiece): boolean {
  return node.type === "prism-table" && node.shape !== "rect";
}

/** A cylinder of the table's width for round and cocktail tables, otherwise a box of the piece's footprint. */
function placeholderGeometry(node: EventPiece) {
  const geometry = isRound(node)
    ? new CylinderGeometry(node.width / 2, node.width / 2, PLACEHOLDER_HEIGHT_M, 32)
    : new BoxGeometry(node.width, PLACEHOLDER_HEIGHT_M, node.depth);
  const mesh = new Mesh(geometry, new MeshStandardMaterial({ color: PLACEHOLDER_COLOR }));
  mesh.position.y = PLACEHOLDER_HEIGHT_M / 2;
  return mesh;
}

/** The piece's outline on the plan, drawn about its centre and placed at its position and rotation. */
function footprint(node: EventPiece): FloorplanGeometry {
  const [halfWidth, halfDepth] = [node.width / 2, node.depth / 2];
  const outline: FloorplanGeometry = isRound(node)
    ? { kind: "circle", cx: 0, cy: 0, r: halfWidth, ...FOOTPRINT_STYLE }
    : { kind: "polygon", points: [[-halfWidth, -halfDepth], [halfWidth, -halfDepth], [halfWidth, halfDepth], [-halfWidth, halfDepth]], ...FOOTPRINT_STYLE };
  return { kind: "group", transform: { translate: [node.position[0], node.position[2]], rotate: -node.rotation }, children: [outline] };
}

const placementDefaults = {
  parentId: null,
  visible: true,
  position: [0, 0, 0] as [number, number, number],
  rotation: 0,
  supplierIds: [],
  locked: false,
};

function sharedDefinition(kind: EventPieceType) {
  return {
    kind,
    schemaVersion: 1,
    category: "furnish" as const,
    capabilities: {
      movable: { axes: ["x", "z"] as const, gridSnap: true },
      rotatable: { axes: ["y"] as const },
      selectable: { hitVolume: "bbox" as const },
      duplicable: true,
      deletable: true,
    },
    geometry: (node: EventPiece) => placeholderGeometry(node),
    geometryKey: (node: EventPiece) => JSON.stringify([node.width, node.depth, isRound(node)]),
    floorplan: (node: EventPiece) => footprint(node),
    tree: { label: (node: unknown) => treeLabel(node, LABELS[kind]) },
    presentation: { label: LABELS[kind], icon: { kind: "url" as const, src: "/icons/item.webp" }, paletteSection: "furnish" as const, paletteGroup: "Event" },
  };
}

/** The layer list names a piece by its label, then its variant, then its type. */
function treeLabel(node: unknown, fallback: string): string {
  const { label, variant } = node as { label?: unknown; variant?: unknown };
  if (typeof label === "string" && label) return label;
  return typeof variant === "string" && variant ? variant : fallback;
}

const tableDefinition: NodeDefinition<typeof prismTableNodeSchema> = {
  ...sharedDefinition("prism-table"),
  schema: prismTableNodeSchema,
  defaults: () => ({ ...placementDefaults, shape: "round" as const, width: 1.8, depth: 1.8, seats: 10, chairStyle: "chiavari", linen: "white", guestIds: [] }),
};

function pieceDefinition(kind: PrismPieceNodeType): NodeDefinition<typeof prismPieceNodeSchema> {
  return {
    ...sharedDefinition(kind),
    schema: prismPieceNodeSchema,
    defaults: () => ({ ...placementDefaults, type: kind, variant: kind.replace(/^prism-/, ""), width: 1, depth: 1 }),
  };
}

const pieceTypes = Object.keys(LABELS).filter((kind): kind is PrismPieceNodeType => kind !== "prism-table");

/**
 * Pascal lists plugin nodes as `NodeDefinition<ZodObject<any>>`, whose callbacks take any node, so a definition
 * typed by its own schema widens here. The registry parses each node with that schema before calling them.
 */
function anyNodeDefinition<S extends AnyNodeDefinition["schema"]>(definition: NodeDefinition<S>): AnyNodeDefinition {
  return definition as AnyNodeDefinition;
}

/**
 * The PRISM event pieces, registered with Pascal so its editor can place, move, draw and save them. Milestone 2
 * replaces the placeholder shapes with the event furniture drawings.
 */
export const prismEventLayoutPlugin: Plugin = {
  id: PRISM_EVENT_LAYOUT_PLUGIN_ID,
  apiVersion: 1,
  nodes: [anyNodeDefinition(tableDefinition), ...pieceTypes.map((kind) => anyNodeDefinition(pieceDefinition(kind)))],
};
