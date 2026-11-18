import type { FloorplanSceneDocument } from "@prism/types";

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
  /** The Pascal editor scene every plan carries. */
  scene: FloorplanSceneDocument;
  sceneFormat: string;
  updatedAt: string;
}

export interface VenueTemplate {
  id: ID;
  ownerId: ID;
  name: string;
  description: string;
  venue: string;
  venueRules: string;
  floorPlanId: ID;
  width: number;
  height: number;
  gridSize: number;
  pax: number;
  /** The venue's Pascal scene. */
  scene: FloorplanSceneDocument;
  sourceType: string;
  createdAt: string;
  updatedAt: string;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
