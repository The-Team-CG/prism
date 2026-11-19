import type { NodeQuickAction, ParamField, ParametricDescriptor } from "@pascal-app/core";
import type {
  PrismBarNode,
  PrismDanceFloorNode,
  PrismEventPieceType,
  PrismPieceNode,
  PrismSeatingBlockNode,
  PrismTableNode,
  PrismZoneNode,
} from "@prism/types";
import { prismTableShapes } from "@prism/types";
import { CENTERPIECES, CHAIR_STYLES, FABRIC_NAMES } from "../dressing";
import { isRoundTable } from "@prism/floorplan-scene";
import { hostState, openSeating } from "./host-state";
import { ZoneSuppliersField } from "./zone-suppliers-field";

const size = <N extends { width: number; depth: number }>(min = 0.3, max = 40): ParamField<N>[] => [
  { key: "width", label: "Width", kind: "number", unit: "m", min, max, step: 0.1 },
  { key: "depth", label: "Depth", kind: "number", unit: "m", min, max, step: 0.1 },
];

/** A sash or overlay is optional: "none" leaves it off. */
const ACCENTS = ["none", ...FABRIC_NAMES] as const;

/** The smallest a U or hollow square can be laid out: two runs and a gap across, and down. */
const JOINED_MIN_M = 3;
const isJoined = (shape: PrismTableNode["shape"]) => shape === "u-shape" || shape === "hollow-square";

/**
 * A round or cocktail table's size is its diameter, so depth follows width. A table turned into a U or hollow square
 * grows to at least the size its runs need. Seats never drop below the guests seated there; the card says to unseat
 * guests first.
 */
export function deriveTable(next: PrismTableNode, patch: Partial<PrismTableNode>): Partial<PrismTableNode> {
  const derived: Partial<PrismTableNode> = {};
  if (isRoundTable(next) && (patch.width !== undefined || patch.shape !== undefined)) derived.depth = next.width;
  if (patch.shape !== undefined && isJoined(next.shape)) {
    derived.width = Math.max(next.width, 6);
    derived.depth = Math.max(next.depth, 5);
  }
  if (patch.seats !== undefined && patch.seats < next.guestIds.length) derived.seats = next.guestIds.length;
  return derived;
}

export const tableParametrics: ParametricDescriptor<PrismTableNode> = {
  groups: [
    {
      label: "Table",
      defaultExpanded: true,
      fields: [
        { key: "shape", label: "Shape", kind: "enum", options: prismTableShapes },
        { key: "width", label: "Size", kind: "number", unit: "m", min: 0.6, max: 20, step: 0.1 },
        { key: "depth", label: "Depth", kind: "number", unit: "m", min: 0.6, max: 20, step: 0.05, visibleIf: (table) => !isRoundTable(table) },
        { key: "seats", label: "Seats", kind: "number", min: 0, max: 60, step: 1 },
        { key: "seatSides", label: "Seated", kind: "enum", options: ["both", "one", "around"], display: "segmented", visibleIf: (table) => table.shape === "rect" },
        { key: "crescent", label: "Crescent", kind: "boolean", visibleIf: (table) => table.shape === "round" },
        { key: "number", label: "Number", kind: "number", min: 1, max: 999, step: 1 },
      ],
    },
    {
      label: "Dressing",
      fields: [
        { key: "chairStyle", label: "Chairs", kind: "enum", options: CHAIR_STYLES },
        { key: "sash", label: "Sash", kind: "enum", options: ACCENTS },
        { key: "linen", label: "Linen", kind: "enum", options: FABRIC_NAMES },
        { key: "overlay", label: "Overlay", kind: "enum", options: ACCENTS },
        { key: "centerpiece", label: "Centerpiece", kind: "enum", options: CENTERPIECES },
      ],
    },
  ],
  derive: deriveTable,
};

const seatingBlockParametrics: ParametricDescriptor<PrismSeatingBlockNode> = {
  groups: [
    {
      label: "Seating",
      defaultExpanded: true,
      fields: [
        { key: "style", label: "Style", kind: "enum", options: ["theater", "classroom", "ceremony"], display: "segmented" },
        { key: "chairStyle", label: "Chairs", kind: "enum", options: CHAIR_STYLES },
        { key: "rows", label: "Rows", kind: "number", min: 1, max: 40, step: 1 },
        { key: "columns", label: "Columns", kind: "number", min: 1, max: 40, step: 1 },
        { key: "aisle", label: "Aisle", kind: "number", unit: "m", min: 0, max: 3, step: 0.1 },
        ...size<PrismSeatingBlockNode>(),
      ],
    },
  ],
};

const stageParametrics: ParametricDescriptor<PrismPieceNode> = {
  groups: [
    {
      label: "Stage",
      defaultExpanded: true,
      fields: [
        ...size<PrismPieceNode>(1, 30),
        { key: "heightM", label: "Height", kind: "number", unit: "m", min: 0.2, max: 2, step: 0.1, default: 0.6 },
        { key: "steps", label: "Steps", kind: "boolean", default: false },
        { key: "backdrop", label: "Truss backdrop", kind: "boolean", default: false },
      ],
    },
  ],
};

const zoneParametrics: ParametricDescriptor<PrismZoneNode> = {
  groups: [
    {
      label: "Zone",
      defaultExpanded: true,
      fields: [...size<PrismZoneNode>(1, 60), { key: "suppliers", label: "Suppliers", kind: "custom", component: ZoneSuppliersField }],
    },
  ],
};

const barParametrics: ParametricDescriptor<PrismBarNode> = {
  groups: [
    {
      label: "Bar",
      defaultExpanded: true,
      fields: [
        { key: "shape", label: "Shape", kind: "enum", options: ["straight", "l"], display: "segmented" },
        ...size<PrismBarNode>(0.5, 12),
        { key: "stools", label: "Stools", kind: "number", min: 0, max: 24, step: 1 },
        { key: "backBar", label: "Back bar", kind: "boolean" },
      ],
    },
  ],
};

const danceFloorParametrics: ParametricDescriptor<PrismDanceFloorNode> = {
  groups: [
    {
      label: "Dance floor",
      defaultExpanded: true,
      fields: [{ key: "finish", label: "Finish", kind: "enum", options: ["parquet", "checker", "white", "led"] }, ...size<PrismDanceFloorNode>(1, 30)],
    },
  ],
};

const sized = <N extends { width: number; depth: number }>(label: string): ParametricDescriptor<N> => ({
  groups: [{ label, defaultExpanded: true, fields: size<N>() }],
});

/** The card's fields for each kind of piece. */
export function parametricsFor(kind: PrismEventPieceType) {
  switch (kind) {
    case "prism-table":
      return tableParametrics;
    case "prism-seating-block":
      return seatingBlockParametrics;
    case "prism-stage":
      return stageParametrics;
    case "prism-zone":
      return zoneParametrics;
    case "prism-dance-floor":
      return danceFloorParametrics;
    case "prism-bar":
      return barParametrics;
    default:
      return sized<PrismPieceNode>("Size");
  }
}

/** "Seat guests" on a table's action bar, only while the plan is editable and the event can seat guests. */
export function tableQuickActions({ node }: { node: { id?: unknown } }): NodeQuickAction[] {
  const { seatingAllowed, readOnly } = hostState.get();
  const tableId = node.id;
  if (!seatingAllowed || readOnly || typeof tableId !== "string") return [];
  return [{ id: "seat-guests", label: "Seat guests", run: () => (openSeating(tableId), undefined) }];
}
