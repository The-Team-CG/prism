export type ID = string;

export type ObjectKind =
  // Furniture
  | 'table'
  | 'chair'
  // Stage & Production
  | 'stage'
  | 'led-wall'
  | 'podium'
  | 'lights-sounds'
  // Registration & Flow
  | 'reg-desk'
  | 'entrance-arch'
  | 'photo-wall'
  | 'photo-booth'
  | 'signage'
  // Safety
  | 'emergency-exit'
  // Structure & Misc
  | 'wall'
  | 'door'
  | 'window'
  | 'bar'
  | 'booth'
  | 'decor'
  | 'label'
  | 'custom-image';

export type EventStatus = 'draft' | 'published';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface CanvasObject {
  id: ID;
  kind: ObjectKind;
  label?: string;
  position: Position;
  size: Size;
  rotation: number;
  zIndex: number;
  locked?: boolean;
  svgMarkup?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface SeatCategory {
  id: ID;
  name: string;
  colorHex: string;
}

export interface Seat {
  id: ID;
  label: string;
  position: Position;
  categoryId: ID | null;
}

export interface FloorPlan {
  id: ID;
  name: string;
  venue: string;
  width: number;
  height: number;
  gridSize: number;
  pax: number;
  ownerId: ID;
  templateId: ID | null;
  eventId: ID | null;
  objects: CanvasObject[];
  guests: JsonValue[];
  suppliers: JsonValue[];
  seats: Seat[];
  seatCategories: SeatCategory[];
  updatedAt: string;
}

export interface VenueTemplate {
  id: ID;
  ownerId: ID;
  name: string;
  description: string;
  venue: string;
  venueRules: string;
  permanentFeatures: CanvasObject[];
  floorPlanId: ID;
  width: number;
  height: number;
  gridSize: number;
  pax: number;
  objects: CanvasObject[];
  includeGuests: boolean;
  includeSuppliers: boolean;
  guests: JsonValue[];
  suppliers: JsonValue[];
  sourceType: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventInstance {
  id: ID;
  ownerId: ID;
  templateId: ID;
  floorPlanId: ID;
  name: string;
  startsAt: string;
  status: EventStatus;
  createdAt: string;
}

export interface PublishedSnapshot {
  id: ID;
  slug: string;
  eventId: ID;
  floorPlan: FloorPlan;
  publishedAt: string;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export const asObject = <T extends object>(value: unknown): T | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as T) : null;
