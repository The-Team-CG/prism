import { Group, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3, type BufferGeometry } from "three";
import type { PrismEventPiece, PrismPieceNode, PrismSeatingBlockNode, PrismTableNode } from "@prism/types";
import { accentOf, chairStyleOf } from "../dressing";
import { blockSeatSpots, seatSpots } from "@prism/floorplan-scene";
import { barDesign } from "./bar";
import { danceFloorDesign } from "./dance-floor";
import { clampedValues, type EventDesign } from "./kit";
import { slotMaterial } from "./materials";
import { chairDesign, deskDesign, runnerDesign } from "./seating";
import { hasSmallPieceDesign, smallPieceDesign } from "./small-pieces";
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
      return hasSmallPieceDesign(piece.variant) ? smallPieceDesign(piece) : stageDesign(piece);
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

const UP = new Vector3(0, 1, 0);
const UNIT = new Vector3(1, 1, 1);

/** A chair standing at (x, z), turned about the vertical by `turn` from facing +z. */
type ChairAt = { x: number; z: number; turn: number };

/** A piece's chairs as one instanced mesh per chair material: copies of one chair in its style. */
function chairs(piece: PrismTableNode | PrismSeatingBlockNode, design: EventDesign, spots: ChairAt[], shading: string): Mesh[] {
  if (spots.length === 0) return [];
  return buildDesign(design).map(({ slot, geometry }) => {
    const instanced = new InstancedMesh(geometry, slotMaterial(piece, slot, shading), spots.length);
    spots.forEach(({ x, z, turn }, index) =>
      instanced.setMatrixAt(index, new Matrix4().compose(new Vector3(x, 0, z), new Quaternion().setFromAxisAngle(UP, turn), UNIT)),
    );
    instanced.castShadow = true;
    return instanced;
  });
}

/** A block's chairs facing its front (−z), plus a classroom's desks and a ceremony's aisle runner. */
function seatingBlock(block: PrismSeatingBlockNode, shading: string): Mesh[] {
  const spots = blockSeatSpots(block).map(({ x, z }) => ({ x, z, turn: Math.PI }));
  const extras = [deskDesign(block), runnerDesign(block)].filter((design) => design !== null);
  return [...chairs(block, chairDesign(chairStyleOf(block.chairStyle), false), spots, shading), ...extras.flatMap((design) => meshes(block, design, shading))];
}

/** A table's own design, and its chairs at its seat spots, each turned to face the table. */
function table(node: PrismTableNode, shading: string): Mesh[] {
  const spots = seatSpots(node).map(({ x, z, away: [ax, az] }) => ({ x, z, turn: Math.atan2(-ax, -az) }));
  const design = chairDesign(chairStyleOf(node.chairStyle), accentOf(node.sash) !== null);
  return [...meshes(node, tableDesign(node), shading), ...chairs(node, design, spots, shading)];
}

/**
 * A piece in 3D: Pascal builds its design, and each material slot gets Pascal's library material for the piece's card.
 * Pascal moves the group's children into the piece's own group, placed at its position and rotation.
 */
export function buildEventPiece(piece: PrismEventPiece, shading = "rendered"): Group {
  const group = new Group();
  const parts =
    piece.type === "prism-seating-block" ? seatingBlock(piece, shading) : piece.type === "prism-table" ? table(piece, shading) : meshes(piece, designFor(piece), shading);
  if (parts.length) group.add(...parts);
  return group;
}

/** The fields that change a piece's look; position, rotation and seated guests do not. */
export function shapeKey(piece: PrismEventPiece): string {
  const { id: _id, parentId: _parent, position: _position, rotation: _rotation, guestIds: _guests, supplierIds: _suppliers, metadata: _metadata, ...shape } =
    piece as PrismEventPiece & { guestIds?: unknown; metadata?: unknown };
  return JSON.stringify(shape);
}
