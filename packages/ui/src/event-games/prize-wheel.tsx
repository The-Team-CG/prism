"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../utils";
import { GAME_CHOICE_COLOURS } from "./choice-tones";

export interface PrizeWheelSegment {
  id: string;
  label: string;
}

export interface PrizeWheelProps {
  segments: readonly PrizeWheelSegment[];
  /** The segment the wheel lands on. Changing from none to a segment plays the spin. */
  landedId?: string | null;
  className?: string;
  /** Called once the spin animation has finished (or straight away when the wheel loads already landed). */
  onSettled?: () => void;
}

const SPIN_MS = 5200;
const FULL_TURNS = 6;

/** Clockwise rotation that puts the middle of segment `index` under the pointer at the top. */
export function landingRotation(index: number, count: number, turns = FULL_TURNS): number {
  const segment = 360 / count;
  return turns * 360 - (index + 0.5) * segment;
}

function segmentPath(index: number, count: number, radius: number): string {
  const start = (index / count) * 2 * Math.PI - Math.PI / 2;
  const end = ((index + 1) / count) * 2 * Math.PI - Math.PI / 2;
  const large = end - start > Math.PI ? 1 : 0;
  const point = (angle: number) => `${(radius * Math.cos(angle)).toFixed(3)} ${(radius * Math.sin(angle)).toFixed(3)}`;
  return `M 0 0 L ${point(start)} A ${radius} ${radius} 0 ${large} 1 ${point(end)} Z`;
}

function shortLabel(label: string): string {
  return label.length > 16 ? `${label.slice(0, 15)}…` : label;
}

/**
 * A drawn prize wheel. It only animates; the outcome always comes from the server, so the wheel turns to
 * whatever segment it is told it landed on.
 */
export function PrizeWheel({ segments, landedId, className, onSettled }: PrizeWheelProps) {
  const count = Math.max(1, segments.length);
  const landedIndex = landedId ? segments.findIndex(({ id }) => id === landedId) : -1;
  const firstRender = useRef(true);
  const [rotation, setRotation] = useState(() => (landedIndex >= 0 ? landingRotation(landedIndex, count, 0) : 0));
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const wasFirst = firstRender.current;
    firstRender.current = false;
    if (landedIndex < 0) return;
    if (wasFirst) {
      onSettled?.();
      return;
    }
    setAnimating(true);
    setRotation(landingRotation(landedIndex, count));
    const timer = window.setTimeout(() => {
      setAnimating(false);
      onSettled?.();
    }, SPIN_MS);
    return () => window.clearTimeout(timer);
    // onSettled is a notification only; re-running the spin when its identity changes would restart the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landedIndex, count]);

  return (
    <div className={cn("relative mx-auto aspect-square w-full max-w-md", className)}>
      <svg viewBox="-105 -105 210 210" className="size-full drop-shadow-xl" role="img" aria-label={landedIndex >= 0 && !animating ? `Prize wheel landed on ${segments[landedIndex]!.label}` : "Prize wheel"}>
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: animating ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.8, 0.18, 1)` : "none",
          }}
        >
          {segments.map((segment, index) => {
            const middle = ((index + 0.5) / count) * 360;
            const highlighted = !animating && index === landedIndex;
            return (
              <g key={segment.id}>
                <path d={segmentPath(index, count, 100)} fill={GAME_CHOICE_COLOURS[index % GAME_CHOICE_COLOURS.length]} stroke="white" strokeWidth={highlighted ? 3 : 1.5} />
                <text
                  transform={`rotate(${middle - 90}) translate(58 0)`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize={count > 8 ? 7 : 9}
                  fontWeight={700}
                >
                  {shortLabel(segment.label)}
                </text>
              </g>
            );
          })}
          <circle r={14} fill="white" />
          <circle r={8} fill="var(--prism-ink)" />
        </g>
      </svg>
      <span aria-hidden="true" className="absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 -translate-y-1 border-x-[14px] border-t-[26px] border-x-transparent border-t-[#f2b134] drop-shadow-md" />
    </div>
  );
}
