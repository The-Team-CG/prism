"use client";

import type { MouseEvent, ReactNode } from "react";
import type { PlanDrawing } from "@prism/floorplan-scene/plan-drawing";

const ROOM_EDGE = "#C01867";
const WALL = "#4A3340";
const PIECE_FILL = "#FFF4EC";
const PIECE_STROKE = "#9060A0";

type Piece = PlanDrawing["pieces"][number];

/** A piece's outline: its ellipse, its box, or a U's or hollow square's runs, each run a box in the piece's frame. */
function Outline({ piece }: { piece: Piece }) {
  if (piece.shape === "circle") return <ellipse cx={piece.cx} cy={piece.cy} rx={piece.width / 2} ry={piece.depth / 2} fill={PIECE_FILL} stroke={PIECE_STROKE} />;
  const boxes = piece.shape === "runs" ? piece.runs : [{ x: 0, y: 0, width: piece.width, depth: piece.depth }];
  return boxes.map((box, index) => (
    <rect key={index} x={piece.cx + box.x - box.width / 2} y={piece.cy + box.y - box.depth / 2} width={box.width} height={box.depth} fill={PIECE_FILL} stroke={PIECE_STROKE} />
  ));
}

/** A piece's outline, turned as the Pascal editor turns it: by -rotation, in SVG's clockwise-positive frame. */
function PieceShape({ piece }: { piece: Piece }) {
  const outline = <Outline piece={piece} />;
  return <g data-piece-id={piece.id} transform={`rotate(${(-piece.rotation * 180) / Math.PI} ${piece.cx} ${piece.cy})`}>{outline}</g>;
}

/**
 * The official plan as a read-only SVG in metres: the room, its walls and its event pieces with their names. `children`
 * draw over the plan in the same metre coordinates, such as review pins.
 */
export function PlanDrawingView({ drawing, label, className, onClick, testId = "plan-drawing", children }: {
  drawing: PlanDrawing;
  label: string;
  className?: string;
  onClick?: (event: MouseEvent<SVGSVGElement>) => void;
  testId?: string;
  children?: ReactNode;
}) {
  const { minX, minY, width, depth } = drawing.room;
  const scale = Math.max(width, depth);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${minX} ${minY} ${width} ${depth}`}
      onClick={onClick}
      className={className}
      data-testid={testId}
    >
      <rect x={minX} y={minY} width={width} height={depth} fill="#FFFFFF" stroke={ROOM_EDGE} strokeWidth={scale * 0.003} />
      {drawing.walls.map((wall) => (
        <line key={wall.id} x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} stroke={WALL} strokeWidth={scale * 0.012} strokeLinecap="square" />
      ))}
      {drawing.pieces.map((piece) => <PieceShape key={piece.id} piece={piece} />)}
      {drawing.pieces.map((piece) => (
        <text key={`${piece.id}-name`} x={piece.cx} y={piece.cy} textAnchor="middle" dominantBaseline="central" fontSize={scale * 0.022} fill="#2B1D27" pointerEvents="none">
          {piece.name}
        </text>
      ))}
      {children}
    </svg>
  );
}
