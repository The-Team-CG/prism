import { floorplanSceneDocumentSchema } from "@prism/types";
import type { PlanDrawing } from "@prism/floorplan-scene";
import { drawingOfScene } from "@/features/floorplan/drawing-of-scene";

export type ReviewRoom = PlanDrawing;
export type ReviewPiece = PlanDrawing["pieces"][number];

export interface AnnotationAnchor {
  /** Position across the room, 0 (left wall) to 1 (right wall). */
  x: number;
  /** Position down the room, 0 (top wall) to 1 (bottom wall). */
  y: number;
}

/** The drawn plan of a submitted snapshot, or null when the snapshot has no scene with walls to draw. */
export function readReviewRoom(snapshot: unknown): ReviewRoom | null {
  const scene: unknown = typeof snapshot === "object" && snapshot !== null ? (snapshot as { scene?: unknown }).scene : undefined;
  const parsed = floorplanSceneDocumentSchema.safeParse(scene);
  return parsed.success ? drawingOfScene(parsed.data) : null;
}

/** Turns a point in plan metres into an anchor across the room box, kept inside the room. */
export function anchorFromRoomPoint(room: ReviewRoom, planX: number, planY: number): AnnotationAnchor {
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return {
    x: clamp((planX - room.room.minX) / room.room.width),
    y: clamp((planY - room.room.minY) / room.room.depth),
  };
}

/** The plan-metre point an anchor sits at. */
export function roomPointFromAnchor(room: ReviewRoom, anchor: AnnotationAnchor): { x: number; y: number } {
  return { x: room.room.minX + anchor.x * room.room.width, y: room.room.minY + anchor.y * room.room.depth };
}

/**
 * Whether a plan point is on a piece. The piece is drawn turned by -rotation, so the point is turned by +rotation
 * into the piece's own frame, where a rectangle is its box and a round piece is its inscribed ellipse.
 */
function pieceContains(piece: ReviewPiece, planX: number, planY: number): boolean {
  const dx = planX - piece.cx;
  const dy = planY - piece.cy;
  const cos = Math.cos(piece.rotation);
  const sin = Math.sin(piece.rotation);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  const halfWidth = piece.width / 2;
  const halfDepth = piece.depth / 2;
  if (piece.shape === "circle") return (localX / halfWidth) ** 2 + (localY / halfDepth) ** 2 <= 1;
  return Math.abs(localX) <= halfWidth && Math.abs(localY) <= halfDepth;
}

/** The topmost piece under an anchor, so a click on a table pins the note to that table. */
export function objectAtAnchor(room: ReviewRoom, anchor: AnnotationAnchor): ReviewPiece | null {
  const { x, y } = roomPointFromAnchor(room, anchor);
  for (let index = room.pieces.length - 1; index >= 0; index -= 1) {
    const piece = room.pieces[index];
    if (pieceContains(piece, x, y)) return piece;
  }
  return null;
}
