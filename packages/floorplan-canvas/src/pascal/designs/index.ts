import { Group, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3, type BufferGeometry } from "three";
import type { PrismEventPiece, PrismPieceNode, PrismSeatingBlockNode } from "@prism/types";
import { barDesign } from "./bar";
import { danceFloorDesign } from "./dance-floor";
import { clampedValues, type EventDesign } from "./kit";
import { slotMaterial } from "./materials";
import { chairDesign, deskDesign, seatingChairPositions } from "./seating";
import { smallPieceDesign } from "./small-pieces";
import { stageDesign } from "./stage";
import { tableDesign } from "./tables";
import { zoneDesign } from "./zone";

import { designRuntime } from "./runtime";

export { setDesignRuntime, type DesignRuntime } from "./runtime";

/** The design a piece is built from. Seating blocks repeat one chair instead (see `seating.ts`). */
export function designFor(piece: Exclude<PrismEventPiece, PrismSeatingBlockNode>): EventDesign {
  switch (piece.type) {
    case "prism-table":
      return tableDesign(piece);
    case "prism-dance-floor":
      return danceFloorDesign(piece);
    case "prism-bar":
      return barDesign(piece);
    case "prism-zone":
      return zoneDesign(piece);
    case "prism-stage":
      return stageDesign(piece);
    default:
      return smallPieceDesign(piece as PrismPieceNode);
  }
}

type Built = Array<{ slot: string; geometry: BufferGeometry }>;

/**
 * Builds are shared by every piece with the same design and values, so thirty identical tables build once. The geometry is
 * marked shared so Pascal's geometry system never disposes it when one piece rebuilds; the set of distinct designs in a
 * room is small, so the cache keeps them for the page's life.
 */
const builds = new Map<string, Built>();

export function buildDesign({ recipe, values }: EventDesign): Built {
  const parameters = clampedValues(recipe, values);
  const key = JSON.stringify([recipe, parameters]);
  const cached = builds.get(key);
  if (cached) return cached;
  const built = designRuntime().build(recipe, parameters);
  for (const { geometry } of built) geometry.userData.shared = true;
  builds.set(key, built);
  return built;
}

function meshes(piece: PrismEventPiece, design: EventDesign, shading: string): Mesh[] {
  return buildDesign(design).map(({ slot, geometry }) => {
    const mesh = new Mesh(geometry, slotMaterial(piece, slot, shading));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  });
}

const FACING_FRONT = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);

/** A block's chairs as one instanced mesh per chair material, plus its desks when it is a classroom. */
function seatingBlock(block: PrismSeatingBlockNode, shading: string): Mesh[] {
  const positions = seatingChairPositions(block);
  const chairs = buildDesign(chairDesign()).map(({ slot, geometry }) => {
    const instanced = new InstancedMesh(geometry, slotMaterial(block, slot, shading), positions.length);
    positions.forEach(([x, z], index) => instanced.setMatrixAt(index, new Matrix4().compose(new Vector3(x, 0, z), FACING_FRONT, new Vector3(1, 1, 1))));
    instanced.castShadow = true;
    return instanced;
  });
  const desks = deskDesign(block);
  return [...chairs, ...(desks ? meshes(block, desks, shading) : [])];
}

/**
 * A piece in 3D: Pascal builds its design, and each material slot gets Pascal's library material for the piece's card.
 * Pascal moves the group's children into the piece's own group, placed at its position and rotation.
 */
export function buildEventPiece(piece: PrismEventPiece, shading = "rendered"): Group {
  const group = new Group();
  const parts = piece.type === "prism-seating-block" ? seatingBlock(piece, shading) : meshes(piece, designFor(piece), shading);
  if (parts.length) group.add(...parts);
  return group;
}

/** The fields that change a piece's look; position, rotation and seated guests do not. */
export function shapeKey(piece: PrismEventPiece): string {
  const { id: _id, parentId: _parent, position: _position, rotation: _rotation, guestIds: _guests, supplierIds: _suppliers, metadata: _metadata, ...shape } =
    piece as PrismEventPiece & { guestIds?: unknown; metadata?: unknown };
  return JSON.stringify(shape);
}
