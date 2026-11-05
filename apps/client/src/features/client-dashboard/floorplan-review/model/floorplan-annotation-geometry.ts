export interface ReviewObject {
  id?: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  stroke: string;
}

export interface ReviewRoom {
  width: number;
  height: number;
  objects: ReviewObject[];
}

export interface AnnotationAnchor {
  /** Position across the room, 0 (left wall) to 1 (right wall). */
  x: number;
  /** Position down the room, 0 (top wall) to 1 (bottom wall). */
  y: number;
}

const DEFAULT_ROOM = { width: 20, height: 12 };

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function readObject(value: unknown): ReviewObject | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (!finite(item.x) || !finite(item.y) || !finite(item.w) || !finite(item.h) || item.hidden === true) return null;
  return {
    id: typeof item.id === "string" ? item.id : undefined,
    name: typeof item.label === "string" && item.label ? item.label : typeof item.name === "string" ? item.name : "",
    kind: typeof item.kind === "string" ? item.kind : "rect",
    x: item.x,
    y: item.y,
    w: Math.max(0, item.w),
    h: Math.max(0, item.h),
    fill: typeof item.fill === "string" ? item.fill : "#FFF4EC",
    stroke: typeof item.stroke === "string" ? item.stroke : "#9060A0",
  };
}

/**
 * The room and drawable objects of a submitted snapshot. The room size comes from the plan; a snapshot without one
 * falls back to the objects' extent so the canvas still shows everything, and objects the PMCM hid are not drawn.
 */
export function readReviewRoom(snapshot: unknown): ReviewRoom {
  const record = (typeof snapshot === "object" && snapshot !== null ? snapshot : {}) as Record<string, unknown>;
  const rawObjects = Array.isArray(record.objects) ? record.objects : [];
  const objects = rawObjects.map(readObject).filter((object): object is ReviewObject => object !== null);
  const planWidth = finite(record.width) && record.width > 0 ? record.width : finite(record.widthM) && record.widthM > 0 ? record.widthM : null;
  const planHeight = finite(record.height) && record.height > 0 ? record.height : finite(record.heightM) && record.heightM > 0 ? record.heightM : null;
  const extentWidth = objects.length ? Math.max(...objects.map((object) => object.x + object.w)) + 1 : DEFAULT_ROOM.width;
  const extentHeight = objects.length ? Math.max(...objects.map((object) => object.y + object.h)) + 1 : DEFAULT_ROOM.height;
  return { width: planWidth ?? extentWidth, height: planHeight ?? extentHeight, objects };
}

/** Turns a point in room metres into an anchor, kept inside the room. */
export function anchorFromRoomPoint(room: ReviewRoom, meterX: number, meterY: number): AnnotationAnchor {
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return { x: clamp(meterX / room.width), y: clamp(meterY / room.height) };
}

/** The topmost object under an anchor, so a click on a table pins the note to that table. Rotation is ignored. */
export function objectAtAnchor(room: ReviewRoom, anchor: AnnotationAnchor): ReviewObject | null {
  const meterX = anchor.x * room.width;
  const meterY = anchor.y * room.height;
  for (let index = room.objects.length - 1; index >= 0; index -= 1) {
    const object = room.objects[index];
    if (object.id && meterX >= object.x && meterX <= object.x + object.w && meterY >= object.y && meterY <= object.y + object.h) return object;
  }
  return null;
}
