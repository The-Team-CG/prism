"use client";

import type { MouseEvent } from "react";
import type { PrismClientFloorPlanAnnotation } from "@prism/types";
import { PlanDrawingView } from "@/features/floorplan/plan-drawing-view";
import { anchorFromRoomPoint, roomPointFromAnchor, type AnnotationAnchor, type ReviewRoom } from "../model/floorplan-annotation-geometry";

/**
 * The submitted official layout, read-only. Clicking it places a pin for a new note; saved notes show as numbered
 * pins in the order they are listed under the plan.
 */
export function FloorplanReviewCanvas({ room, annotations, pending, canPlace, onPlace }: {
  room: ReviewRoom;
  annotations: PrismClientFloorPlanAnnotation[];
  pending: AnnotationAnchor | null;
  canPlace: boolean;
  onPlace: (anchor: AnnotationAnchor) => void;
}) {
  const pinRadius = Math.max(room.room.width, room.room.depth) * 0.018;

  function place(event: MouseEvent<SVGSVGElement>) {
    if (!canPlace) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const planX = room.room.minX + ((event.clientX - box.left) / box.width) * room.room.width;
    const planY = room.room.minY + ((event.clientY - box.top) / box.height) * room.room.depth;
    onPlace(anchorFromRoomPoint(room, planX, planY));
  }

  const pendingPoint = pending ? roomPointFromAnchor(room, pending) : null;
  return (
    <PlanDrawingView
      drawing={room}
      label="Official floorplan. Click to pin a note."
      testId="floorplan-review-canvas"
      onClick={place}
      className={"w-full rounded-md border border-border bg-background " + (canPlace ? "cursor-crosshair" : "")}
    >
      {annotations.map((annotation, index) => {
        if (annotation.anchorX === undefined || annotation.anchorY === undefined) return null;
        const at = roomPointFromAnchor(room, { x: annotation.anchorX, y: annotation.anchorY });
        return (
          <g key={annotation.id} data-testid="saved-pin">
            <circle cx={at.x} cy={at.y} r={pinRadius} fill="#C01867" />
            <text x={at.x} y={at.y + pinRadius * 0.4} textAnchor="middle" fontSize={pinRadius * 1.2} fill="#FFFFFF">{index + 1}</text>
          </g>
        );
      })}
      {pendingPoint ? <circle data-testid="pending-pin" cx={pendingPoint.x} cy={pendingPoint.y} r={pinRadius} fill="none" stroke="#C01867" strokeWidth={pinRadius * 0.35} /> : null}
    </PlanDrawingView>
  );
}
