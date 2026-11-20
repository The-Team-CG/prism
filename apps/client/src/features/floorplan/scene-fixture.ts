import { FLOORPLAN_SCENE_FORMAT, type FloorplanSceneDocument } from "@prism/types";

type NodeFields = { id: string; type: string; visible?: boolean; [field: string]: unknown };

/** A scene with a level holding the given nodes, for client tests. */
export function sceneWith(nodes: NodeFields[]): FloorplanSceneDocument {
  const level = { id: "level", type: "level", parentId: null, visible: true };
  return {
    format: FLOORPLAN_SCENE_FORMAT,
    pascalVersion: "1.1.6",
    rootNodeIds: ["level"],
    nodes: Object.fromEntries([level, ...nodes].map((node) => [node.id, { parentId: "level", visible: true, ...node }])),
  };
}

/** Four walls around a room from the origin, `width` metres across and `depth` metres down. */
export function roomWalls(width: number, depth: number): NodeFields[] {
  const corners = [[0, 0], [width, 0], [width, depth], [0, depth]] as const;
  return corners.map(([x, y], index) => {
    const [endX, endY] = corners[(index + 1) % corners.length];
    return { id: `wall-${index}`, type: "wall", start: [x, y], end: [endX, endY] };
  });
}

/** A table piece centred at (x, y) plan metres. */
export function tablePiece(id: string, fields: { x: number; y: number; width: number; depth: number; shape?: "round" | "rect"; rotation?: number; label?: string; visible?: boolean }): NodeFields {
  const { x, y, ...size } = fields;
  return {
    id,
    type: "prism-table",
    position: [x, 0, y],
    rotation: fields.rotation ?? 0,
    shape: fields.shape ?? "rect",
    seats: 8,
    guestIds: [],
    ...size,
    ...(fields.label === undefined ? {} : { label: fields.label }),
    ...(fields.visible === undefined ? {} : { visible: fields.visible }),
  };
}
