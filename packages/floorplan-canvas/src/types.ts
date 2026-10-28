import type {
  FloorPlanCanvasObject,
  FloorPlanElementCategory,
  FloorPlanGuest,
  FloorPlanRsvp,
  FloorPlanShapeKind,
  FloorPlanSupplier,
  FloorPlanSupplierKind,
  FloorPlanSupplierStatus,
  TableAssignmentIneligibleReason,
  TableAssignmentRejection,
} from "@prism/types";

// The editor's object and guest shapes are the saved contract in @prism/types; these aliases keep editor imports stable.
export type ShapeKind = FloorPlanShapeKind;

export type ElementCategory = FloorPlanElementCategory;

/** Editor object. x/y/w/h are meters (top-left for rect/ellipse, start for line); rotation is radians. */
export type CanvasObject = FloorPlanCanvasObject;

export type SupplierKind = FloorPlanSupplierKind;

export type SupplierStatus = FloorPlanSupplierStatus;

/** Supplier on the editor roster; `contact` is a phone or email. */
export type Supplier = FloorPlanSupplier;

export type RSVP = FloorPlanRsvp;

/** Guest on the editor roster. `group` is the table group / party, e.g. "Bride's family". */
export type Guest = FloorPlanGuest;

export interface Viewport {
  tx: number; // screen translate x (px)
  ty: number;
  zoom: number; // screen px per meter
}

export interface Project {
  id: string;
  name: string;
  venue: string;
  widthM: number;
  heightM: number;
  pax: number;
  objects: CanvasObject[];
  guests: Guest[];
  suppliers: Supplier[];
  updatedAt: number;
  createdAt: number;
}

export type Tool =
  | "select"
  | "hand"
  | "rect"
  | "ellipse"
  | "line"
  | "text";

/** Why a guest cannot be seated at a table. Stable codes from @prism/types; copy is supplied by the role app. */
export type { TableAssignmentIneligibleReason, TableAssignmentRejection };

export interface EditorState {
  project: Project;
  viewport: Viewport;
  selectedIds: string[];
  tool: Tool;
  hoveredId: string | null;
  history: { past: Project[]; future: Project[] };
  clipboard: CanvasObject[] | null;
  gridSize: number; // meters
  snap: boolean;
  /** Most recent refused table assignment, shown until the next assignment attempt or dismissal. */
  assignmentRejection: TableAssignmentRejection | null;
  /** Measured canvas size in px; lets controls outside the canvas (Fit plan) frame the plan. */
  canvasSize?: { w: number; h: number };
}
