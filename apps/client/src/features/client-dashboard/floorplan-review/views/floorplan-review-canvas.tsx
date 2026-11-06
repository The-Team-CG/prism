"use client";

import type { PrismClientFloorPlanAnnotation } from "@prism/types";
import { anchorFromRoomPoint, type AnnotationAnchor, type ReviewRoom } from "../model/floorplan-annotation-geometry";

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
  const pinRadius = Math.max(room.width, room.height) * 0.018;

  function place(event: React.MouseEvent<SVGSVGElement>) {
    if (!canPlace) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    onPlace(anchorFromRoomPoint(room, ((event.clientX - box.left) / box.width) * room.width, ((event.clientY - box.top) / box.height) * room.height));
  }

  return (
    <svg
      role="img"
      aria-label="Official floorplan. Click to pin a note."
      viewBox={`0 0 ${room.width} ${room.height}`}
      onClick={place}
      className={"w-full rounded-md border border-border bg-background " + (canPlace ? "cursor-crosshair" : "")}
      data-testid="floorplan-review-canvas"
    >
      <rect x={0} y={0} width={room.width} height={room.height} fill="#FFFFFF" stroke="#C01867" strokeWidth={0.06} />
      {room.objects.map((object, index) => {
        const key = object.id ?? `object-${index}`;
        if (object.kind === "ellipse") {
          return <ellipse key={key} cx={object.x + object.w / 2} cy={object.y + object.h / 2} rx={object.w / 2} ry={object.h / 2} fill={object.fill} stroke={object.stroke} strokeWidth={0.04} />;
        }
        if (object.kind === "line") {
          return <line key={key} x1={object.x} y1={object.y + object.h / 2} x2={object.x + object.w} y2={object.y + object.h / 2} stroke={object.stroke} strokeWidth={Math.max(0.08, object.h)} />;
        }
        return <rect key={key} x={object.x} y={object.y} width={object.w} height={object.h} fill={object.fill} stroke={object.stroke} strokeWidth={0.04} />;
      })}
      {annotations.map((annotation, index) =>
        annotation.anchorX === undefined || annotation.anchorY === undefined ? null : (
          <g key={annotation.id} data-testid="saved-pin">
            <circle cx={annotation.anchorX * room.width} cy={annotation.anchorY * room.height} r={pinRadius} fill="#C01867" />
            <text x={annotation.anchorX * room.width} y={annotation.anchorY * room.height + pinRadius * 0.4} textAnchor="middle" fontSize={pinRadius * 1.2} fill="#FFFFFF">{index + 1}</text>
          </g>
        ),
      )}
      {pending ? <circle data-testid="pending-pin" cx={pending.x * room.width} cy={pending.y * room.height} r={pinRadius} fill="none" stroke="#C01867" strokeWidth={pinRadius * 0.35} /> : null}
    </svg>
  );
}
