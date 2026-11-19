import { spatialGridManager, type AnyNodeDefinition, type DuplicateSubtreeCloneArgs, type NodeDefinition, type Plugin } from "@pascal-app/core";
import { Group } from "three";
import {
  FLOORPLAN_EVENT_LAYOUT_PLUGIN_ID,
  placeableEventPieceSchemaFor,
  prismEventPieceTypes,
  type PrismEventPiece,
  type PrismEventPieceType,
} from "@prism/types";
import { parametricsFor, tableQuickActions } from "./inspector/parametrics";
import { eventSymbol, type SymbolView } from "./symbols";
import { buildEventPiece, shapeKey } from "./designs";
import { nextTableNumberAmong } from "./tools/place-node";

export const PRISM_EVENT_LAYOUT_PLUGIN_ID = FLOORPLAN_EVENT_LAYOUT_PLUGIN_ID;

/** The height of the floor under a piece's centre: a room's floor plate stands a few centimetres off the ground. */
const floorUnder = (node: EventPiece) => (node.parentId ? spatialGridManager.getSlabElevationAt(node.parentId, node.position[0], node.position[2]) : 0);

/** Stands a built piece on the floor at `height`; Pascal places the piece's group at its position on the ground. */
function onTheFloor(built: Group, height: number): Group {
  if (height === 0) return built;
  const lifted = new Group();
  lifted.position.y = height;
  if (built.children.length) lifted.add(...built.children);
  const wrapper = new Group();
  wrapper.add(lifted);
  return wrapper;
}

type EventPiece = PrismEventPiece;
type EventPieceType = PrismEventPieceType;

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
  "prism-seating-block": "Seating block",
  "prism-dance-floor": "Dance floor",
  "prism-bar": "Bar",
  "prism-zone": "Supplier zone",
};

/**
 * A copy keeps the piece's shape, size and place but starts with nobody seated, so it never lists a guest who is
 * already seated at the original, and it is a new piece rather than the converted legacy object.
 */
function emptyCopy({ root, nodes }: DuplicateSubtreeCloneArgs) {
  const { legacyId: _legacyId, ...metadata } = (root.metadata ?? {}) as Record<string, unknown>;
  // Pascal types `root` as one of its own node kinds; a PRISM piece arrives here as one of ours.
  const piece = root as unknown as { type: string; label?: unknown };
  const table = piece.type === "prism-table" ? nextTableFields(piece, Object.values(nodes)) : {};
  return { root: { ...root, metadata, ...table } as typeof root };
}

/** A label that is only the table's number ("T12", "12") follows the number; any other label is the planner's own. */
const NUMBER_LABEL = /^T?\s*\d+$/i;

/** The copy is the next table in the room: one past the highest table number, with nobody seated yet. */
function nextTableFields(original: { label?: unknown }, nodes: readonly unknown[]) {
  const number = nextTableNumberAmong(nodes);
  const keepsLabel = typeof original.label === "string" && original.label !== "" && !NUMBER_LABEL.test(original.label);
  return { number, guestIds: [], ...(keepsLabel ? {} : { label: `T${number}` }) };
}

const placementDefaults = {
  parentId: null,
  visible: true,
  position: [0, 0, 0] as [number, number, number],
  rotation: 0,
  supplierIds: [],
  locked: false,
};

/** A locked piece neither moves nor turns, until it is unlocked from the Layers list. */
const STAY_PUT = { axes: [] as const };
const isLocked = (node: unknown) => (node as { locked?: unknown }).locked === true;

function sharedDefinition(kind: EventPieceType) {
  return {
    kind,
    schemaVersion: 1,
    category: "furnish" as const,
    capabilities: {
      movable: { axes: ["x", "z"] as const, gridSnap: true, override: ({ node }: { node: unknown }) => (isLocked(node) ? STAY_PUT : null) },
      rotatable: { axes: ["y"] as const, override: ({ node }: { node: unknown }) => (isLocked(node) ? STAY_PUT : null) },
      selectable: { hitVolume: "bbox" as const },
      // Pascal clones a subtree with fresh ids itself; a root-only copy would ask the schema for an id instead.
      duplicable: { subtree: true, prepareSubtreeClone: emptyCopy },
      deletable: true,
    },
    // Pascal passes the editor's shading as a third argument, which picks the library materials' look.
    geometry: (node: EventPiece, _ctx: unknown, shading?: string) => onTheFloor(buildEventPiece(node, shading), floorUnder(node)),
    geometryKey: (node: EventPiece) => `${shapeKey(node)}@${floorUnder(node)}`,
    floorplan: (node: EventPiece, ctx?: { viewState?: SymbolView }) => eventSymbol(node, LABELS[kind], ctx?.viewState),
    // One placement tool serves every kind: it reads the armed kind and the Library tile's values from the editor.
    tool: () => import("./tools/place-piece-tool"),
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

/** What a piece of each kind starts as when the Library tile gives no value for a field. */
const KIND_DEFAULTS: Partial<Record<EventPieceType, Record<string, unknown>>> = {
  "prism-table": { shape: "round", width: 1.8, depth: 1.8, seats: 10, chairStyle: "chiavari", linen: "white", guestIds: [] },
  "prism-seating-block": { style: "theater", rows: 5, columns: 4, aisle: 0, width: 2, depth: 4.5 },
  "prism-dance-floor": { width: 6, depth: 6 },
  "prism-bar": { shape: "straight", width: 3, depth: 0.8 },
  "prism-zone": { label: "Supplier zone", width: 4, depth: 3 },
};

export function eventPieceDefaults(kind: EventPieceType): Record<string, unknown> {
  return { ...placementDefaults, type: kind, ...(KIND_DEFAULTS[kind] ?? { variant: kind.replace(/^prism-/, ""), width: 1, depth: 1 }) };
}

/** Pascal parses a newly placed node without an id, so each kind's schema mints one. */
function eventPieceDefinition(kind: EventPieceType) {
  const schema = placeableEventPieceSchemaFor(kind);
  const definition: NodeDefinition<typeof schema> = { ...sharedDefinition(kind), schema, defaults: () => eventPieceDefaults(kind) };
  return definition;
}

/**
 * Pascal lists plugin nodes as `NodeDefinition<ZodObject<any>>`, whose callbacks take any node, so a definition
 * typed by its own schema widens here. The registry parses each node with that schema before calling them.
 */
function anyNodeDefinition<S extends AnyNodeDefinition["schema"]>(definition: NodeDefinition<S>): AnyNodeDefinition {
  return definition as AnyNodeDefinition;
}

/** A kind's card fields widen the same way: the registry hands them only nodes of that kind. */
function anyParametrics(descriptor: ReturnType<typeof parametricsFor>): NonNullable<AnyNodeDefinition["parametrics"]> {
  return descriptor as NonNullable<AnyNodeDefinition["parametrics"]>;
}

/**
 * The PRISM event pieces, registered with Pascal so its editor can place, move, draw and save them. Milestone 2
 * replaces the placeholder shapes with the event furniture drawings.
 */
export const prismEventLayoutPlugin: Plugin = {
  id: PRISM_EVENT_LAYOUT_PLUGIN_ID,
  apiVersion: 1,
  nodes: prismEventPieceTypes.map((kind) => ({
    ...anyNodeDefinition(eventPieceDefinition(kind)),
    parametrics: anyParametrics(parametricsFor(kind)),
    ...(kind === "prism-table" ? { quickActions: tableQuickActions } : {}),
  })),
};
