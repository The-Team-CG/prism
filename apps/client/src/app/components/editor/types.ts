export type ShapeKind = "rect" | "ellipse" | "line";

export type ElementCategory =
  | "furniture"
  | "stage"
  | "registration"
  | "safety"
  | "architecture";

export interface CanvasObject {
  id: string;
  name: string;
  kind: ShapeKind;
  category: ElementCategory;
  x: number; // meters (top-left for rect/ellipse, start for line)
  y: number;
  w: number; // meters
  h: number; // meters
  rotation: number; // radians
  fill: string;
  stroke: string;
  strokeWidth: number;
  label?: string;
  seats?: number;
  assignedGuestIds?: string[];
  assignedSupplierIds?: string[];
  locked: boolean;
  hidden: boolean;
}

export type SupplierKind =
  | "catering"
  | "av"
  | "floral"
  | "staging"
  | "security"
  | "rental"
  | "photography"
  | "other";

export type SupplierStatus = "booked" | "proposed" | "confirmed" | "cancelled";

export interface Supplier {
  id: string;
  name: string;
  kind: SupplierKind;
  contact?: string; // phone or email
  status: SupplierStatus;
  notes?: string;
}

export type RSVP = "confirmed" | "pending" | "declined";

export interface Guest {
  id: string;
  name: string;
  rsvp: RSVP;
  group?: string; // table group / party, e.g. "Bride's family"
  dietary?: string; // e.g. "Vegan", "Gluten-free"
  notes?: string;
}

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
}
