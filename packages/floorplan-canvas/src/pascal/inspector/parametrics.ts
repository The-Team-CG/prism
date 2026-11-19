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
import { hostState, openSeating } from "./host-state";
import { ZoneSuppliersField } from "./zone-suppliers-field";

const size = <N extends { width: number; depth: number }>(min = 0.3, max = 40): ParamField<N>[] => [
  { key: "width", label: "Width", kind: "number", unit: "m", min, max, step: 0.1 },
  { key: "depth", label: "Depth", kind: "number", unit: "m", min, max, step: 0.1 },
];

export const CHAIR_STYLES = ["chiavari", "banquet", "ghost", "cross-back"] as const;
export const LINENS = ["white", "ivory", "black", "blush"] as const;
export const CENTERPIECES = ["none", "low floral", "tall floral", "candles"] as const;

/**
 * A round or cocktail table's size is its diameter, so depth follows width. Seats never drop below the guests seated
 * there; the card says to unseat guests first.
 */
export function deriveTable(next: PrismTableNode, patch: Partial<PrismTableNode>): Partial<PrismTableNode> {
  const derived: Partial<PrismTableNode> = {};
  if (next.shape !== "rect" && (patch.width !== undefined || patch.shape !== undefined)) derived.depth = next.width;
  if (patch.seats !== undefined && patch.seats < next.guestIds.length) derived.seats = next.guestIds.length;
  return derived;
}

export const tableParametrics: ParametricDescriptor<PrismTableNode> = {
  groups: [
    {
      label: "Table",
      defaultExpanded: true,
      fields: [
        { key: "shape", label: "Shape", kind: "enum", options: ["round", "rect", "cocktail"], display: "segmented" },
        { key: "width", label: "Size", kind: "number", unit: "m", min: 0.6, max: 3.6, step: 0.1 },
        { key: "depth", label: "Depth", kind: "number", unit: "m", min: 0.6, max: 1.2, step: 0.05, visibleIf: (table) => table.shape === "rect" },
        { key: "seats", label: "Seats", kind: "number", min: 0, max: 24, step: 1 },
        { key: "number", label: "Number", kind: "number", min: 1, max: 999, step: 1 },
      ],
    },
    {
      label: "Dressing",
      fields: [
        { key: "chairStyle", label: "Chairs", kind: "enum", options: CHAIR_STYLES },
        { key: "linen", label: "Linen", kind: "enum", options: LINENS },
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
        { key: "style", label: "Style", kind: "enum", options: ["theater", "classroom"], display: "segmented" },
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
      return sized<PrismDanceFloorNode>("Dance floor");
    case "prism-bar":
      return sized<PrismBarNode>("Bar");
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
