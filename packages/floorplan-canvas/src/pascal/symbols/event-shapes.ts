import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, type BufferGeometry, type Material } from "three";
import type { PrismBarNode, PrismEventPiece, PrismPieceNode, PrismSeatingBlockNode, PrismTableNode } from "@prism/types";

const TABLE_HEIGHT_M = 0.75;
const CHAIR_SIZE_M = 0.45;
const CHAIR_HEIGHT_M = 0.9;

// Shared across every piece, so a 300-seat room reuses one chair geometry and a handful of materials.
const materials = {
  linen: new MeshStandardMaterial({ color: "#ffffff" }),
  chair: new MeshStandardMaterial({ color: "#d8c0b8" }),
  stage: new MeshStandardMaterial({ color: "#3a2f37" }),
  floor: new MeshStandardMaterial({ color: "#f8ebe1" }),
  piece: new MeshStandardMaterial({ color: "#c9b8d6" }),
  zone: new MeshStandardMaterial({ color: "#40a0d0", transparent: true, opacity: 0.18, depthWrite: false }),
};
const chairGeometry = new BoxGeometry(CHAIR_SIZE_M, CHAIR_HEIGHT_M, CHAIR_SIZE_M);

function mesh(geometry: BufferGeometry, material: Material, x: number, y: number, z: number): Mesh {
  const part = new Mesh(geometry, material);
  part.position.set(x, y, z);
  return part;
}

const chairAt = (x: number, z: number) => mesh(chairGeometry, materials.chair, x, CHAIR_HEIGHT_M / 2, z);
const box = (width: number, height: number, depth: number, material: Material, x = 0, z = 0) =>
  mesh(new BoxGeometry(width, height, depth), material, x, height / 2, z);

function tableShape(node: PrismTableNode): Mesh[] {
  const top =
    node.shape === "rect"
      ? box(node.width, TABLE_HEIGHT_M, node.depth, materials.linen)
      : mesh(new CylinderGeometry(node.width / 2, node.width / 2, TABLE_HEIGHT_M, 32), materials.linen, 0, TABLE_HEIGHT_M / 2, 0);
  const ring = node.width / 2 + 0.35;
  const chairs = Array.from({ length: node.shape === "rect" ? 0 : node.seats }, (_, index) => {
    const angle = (2 * Math.PI * index) / node.seats;
    return chairAt(Math.cos(angle) * ring, Math.sin(angle) * ring);
  });
  const banquet = node.shape === "rect" ? banquetChairs(node) : [];
  return [top, ...chairs, ...banquet];
}

function banquetChairs(node: PrismTableNode): Mesh[] {
  const near = Math.ceil(node.seats / 2);
  const side = (count: number, z: number) => Array.from({ length: count }, (_, index) => chairAt(-node.width / 2 + (node.width * (index + 0.5)) / count, z));
  const offset = node.depth / 2 + 0.35;
  return [...side(near, offset), ...side(node.seats - near, -offset)];
}

function seatingBlockShape(node: PrismSeatingBlockNode): Mesh[] {
  const [across, along] = [(node.width - node.aisle) / node.columns, node.depth / node.rows];
  const half = Math.floor(node.columns / 2);
  return Array.from({ length: node.rows * node.columns }, (_, index) => {
    const [row, column] = [Math.floor(index / node.columns), index % node.columns];
    const x = -node.width / 2 + across * (column + 0.5) + (column >= half ? node.aisle : 0);
    return chairAt(x, -node.depth / 2 + along * (row + 0.5));
  });
}

/** Piece heights in metres by variant; anything unlisted stands 0.9 m tall. */
const HEIGHTS: Record<string, number> = { "led-wall": 3, speaker: 1.6, arch: 2.4, backdrop: 2.4, booth: 2.4, extinguisher: 0.6 };

function pieceShape(node: PrismPieceNode): Mesh[] {
  if (node.type === "prism-stage") return [box(node.width, node.heightM ?? 0.6, node.depth, materials.stage)];
  return [box(node.width, HEIGHTS[node.variant] ?? 0.9, node.depth, materials.piece)];
}

function barShape(node: PrismBarNode): Mesh[] {
  if (node.shape === "straight") return [box(node.width, 1.1, node.depth, materials.piece)];
  const counter = Math.min(0.8, node.width / 2, node.depth / 2);
  return [
    box(node.width, 1.1, counter, materials.piece, 0, -node.depth / 2 + counter / 2),
    box(counter, 1.1, node.depth - counter, materials.piece, -node.width / 2 + counter / 2, counter / 2),
  ];
}

function partsOf(node: PrismEventPiece): Mesh[] {
  switch (node.type) {
    case "prism-table":
      return tableShape(node);
    case "prism-seating-block":
      return seatingBlockShape(node);
    case "prism-dance-floor":
      return [box(node.width, 0.03, node.depth, materials.floor)];
    case "prism-bar":
      return barShape(node);
    case "prism-zone":
      return [box(node.width, 0.02, node.depth, materials.zone)];
    default:
      return pieceShape(node);
  }
}

/**
 * The piece in 3D as one group of simple meshes. Pascal moves the group's children into the piece's own group, which
 * it places at the piece's position and rotation.
 */
export function eventShape(node: PrismEventPiece): Group {
  const group = new Group();
  group.add(...partsOf(node));
  return group;
}

/** The fields that change a piece's shape; position, rotation and seated guests do not. */
export function shapeKey(node: PrismEventPiece): string {
  const { id: _id, parentId: _parent, position: _position, rotation: _rotation, guestIds: _guests, supplierIds: _suppliers, metadata: _metadata, ...shape } =
    node as PrismEventPiece & { guestIds?: unknown; metadata?: unknown };
  return JSON.stringify(shape);
}
