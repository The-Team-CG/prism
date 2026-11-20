"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useViewer } from "@pascal-app/viewer";
import { footprint, gapBetween, isHiddenInScene, isRoundTable, pieceName, planDrawing, roomSize } from "@prism/floorplan-scene";
import { isPrismEventPieceType, prismEventPieceSchemaFor, type FloorplanSceneDocument, type PrismEventPiece } from "@prism/types";
import { useLiveScene } from "./use-live-scene";

const INK = "#6f6a6d";
const MAGENTA = "#be185d";
/** Text and chip sizes in plan metres: the drawing scales with the zoom, as dimensions on a printed plan do. */
const TEXT_M = 0.6;
const OFFSET_M = 1.6;
const metres = (value: number) => `${value.toFixed(1)} m`;
/** A rough width for a label set at `TEXT_M`, enough to size the chip behind it. */
const labelWidth = (text: string) => text.length * TEXT_M * 0.56 + 0.36;

type LabelProps = { x: number; y: number; text: string; upright: number; fill?: string; color?: string };

/** A dimension's text on a chip, turned against the view's rotation so it always reads level. */
function Label({ x, y, text, upright, fill = "#f6f4f3", color = INK }: LabelProps) {
  const width = labelWidth(text);
  return (
    <g transform={`translate(${x} ${y}) rotate(${upright})`}>
      <rect x={-width / 2} y={-TEXT_M * 0.85} width={width} height={TEXT_M * 1.7} rx={TEXT_M * 0.4} fill={fill} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={TEXT_M} fill={color} fontWeight={500} style={{ fontVariantNumeric: "tabular-nums" }}>
        {text}
      </text>
    </g>
  );
}

/** The room's width along its top wall and its depth along its left wall, as dimension lines outside it. */
function RoomDimensions({ scene, upright }: { scene: FloorplanSceneDocument; upright: number }) {
  if (!roomSize(scene)) return null;
  const { room } = planDrawing(scene);
  const top = room.minY - OFFSET_M;
  const left = room.minX - OFFSET_M;
  const right = room.minX + room.width;
  const bottom = room.minY + room.depth;
  const tick = 0.25;
  const line = { stroke: INK, strokeWidth: 1, vectorEffect: "non-scaling-stroke" as const };
  return (
    <g data-plan-measure="room">
      <path d={`M${room.minX} ${top}H${right}M${room.minX} ${top - tick}v${2 * tick}M${right} ${top - tick}v${2 * tick}`} {...line} />
      <path d={`M${left} ${room.minY}V${bottom}M${left - tick} ${room.minY}h${2 * tick}M${left - tick} ${bottom}h${2 * tick}`} {...line} />
      <Label x={room.minX + room.width / 2} y={top} text={metres(room.width)} upright={upright} />
      <Label x={left} y={room.minY + room.depth / 2} text={metres(room.depth)} upright={upright} />
    </g>
  );
}

type Standing = { piece: PrismEventPiece; name: string };

/** Visible event pieces that stand on the floor: what a selected piece's gap is measured to. */
function standingPieces(scene: FloorplanSceneDocument): Standing[] {
  return Object.values(scene.nodes).flatMap((node) => {
    if (!isPrismEventPieceType(node.type) || isHiddenInScene(scene, node.id) || node.type === "prism-zone" || node.type === "prism-shape") return [];
    return [{ piece: prismEventPieceSchemaFor(node.type).parse(node) as PrismEventPiece, name: pieceName(node as never) }];
  });
}

const sizeOf = (piece: PrismEventPiece) => (isRoundTable(piece) ? `Ø ${metres(piece.width)}` : `${piece.width.toFixed(1)} × ${metres(piece.depth)}`);

/** The selected piece's size and how far it stands from its nearest neighbour, in a chip under it. */
function SelectionMeasure({ scene, id, upright }: { scene: FloorplanSceneDocument; id: string; upright: number }) {
  const pieces = standingPieces(scene);
  const selected = pieces.find(({ piece }) => piece.id === id);
  if (!selected) return null;
  const body = footprint(selected.piece, isRoundTable(selected.piece));
  const nearest = pieces
    .filter((other) => other !== selected)
    .map((other) => ({ name: other.name, gap: gapBetween(body, footprint(other.piece, isRoundTable(other.piece))) }))
    .sort((a, b) => a.gap - b.gap)[0];
  const [x, , z] = selected.piece.position;
  const below = Math.max(...body.map(([, pz]) => pz)) + 1.1;
  const text = nearest ? `${sizeOf(selected.piece)} · ${metres(nearest.gap)} to ${nearest.name}` : sizeOf(selected.piece);
  return (
    <g data-plan-measure="selection">
      <Label x={x} y={below} text={text} upright={upright} fill={MAGENTA} color="#ffffff" />
    </g>
  );
}

const ROTATION = /rotate\(\s*(-?[\d.e+-]+)/;

/**
 * How far Pascal has turned the plan, in degrees, read from the scene group the host slot sits in. Pascal turns it
 * imperatively while the planner rotates the view, so the attribute is watched rather than read once.
 */
function useSceneRotation(inside: RefObject<SVGGElement | null>): number {
  const [degrees, setDegrees] = useState(0);
  const watched = useRef<{ scene: Element; observer: MutationObserver } | null>(null);
  // Pascal may mount the slot before its scene group is in place, so each render looks again until it is found.
  useLayoutEffect(() => {
    const scene = inside.current?.closest("[data-floorplan-scene]") ?? null;
    if (!scene || watched.current?.scene === scene) return;
    watched.current?.observer.disconnect();
    const read = () => setDegrees(Number(ROTATION.exec(scene.getAttribute("transform") ?? "")?.[1] ?? 0));
    read();
    const observer = new MutationObserver(read);
    observer.observe(scene, { attributes: true, attributeFilter: ["transform"] });
    watched.current = { scene, observer };
  });
  useLayoutEffect(() => () => watched.current?.observer.disconnect(), []);
  return degrees;
}

/** Dimensions drawn over the plan in metres: the room's size, and the selected piece's size and nearest gap. */
export function PlanMeasures() {
  const scene = useLiveScene();
  const selected = useViewer((state) => state.selection.selectedIds);
  const root = useRef<SVGGElement>(null);
  const upright = -useSceneRotation(root);
  return (
    <g ref={root} pointerEvents="none" aria-hidden fontFamily="inherit">
      <RoomDimensions scene={scene} upright={upright} />
      {selected.length === 1 ? <SelectionMeasure scene={scene} id={selected[0]!} upright={upright} /> : null}
    </g>
  );
}
