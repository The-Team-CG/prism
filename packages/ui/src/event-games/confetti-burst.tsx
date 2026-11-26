"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "./motion";

const COLOURS = ["#c01867", "#1d6f9c", "#c2470a", "#1c7a70", "#f2b134", "#ffffff"];
const PIECES = 36;

/**
 * A short burst of confetti over its parent, for a right answer or a win. It plays once on mount, takes no
 * pointer events and leaves nothing behind; viewers who prefer reduced motion see nothing.
 */
export function ConfettiBurst({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element || prefersReducedMotion() || typeof element.animate !== "function") return;
    const pieces = Array.from({ length: PIECES }, (_, index) => {
      const piece = document.createElement("span");
      const size = 6 + (index % 4) * 2;
      Object.assign(piece.style, {
        position: "absolute", left: "50%", top: "40%", width: `${size}px`, height: `${size * 0.45}px`,
        background: COLOURS[index % COLOURS.length], borderRadius: "2px",
      });
      element.appendChild(piece);
      const angle = (index / PIECES) * Math.PI * 2;
      const reach = 90 + (index % 5) * 30;
      piece.animate([
        { transform: "translate(-50%, -50%) rotate(0deg)", opacity: 1 },
        { transform: `translate(${Math.cos(angle) * reach}px, ${Math.sin(angle) * reach + 140}px) rotate(${(index % 2 ? 1 : -1) * 540}deg)`, opacity: 0 },
      ], { duration: 1300 + (index % 6) * 90, easing: "cubic-bezier(0.15, 0.7, 0.3, 1)", fill: "forwards" });
      return piece;
    });
    const cleanup = window.setTimeout(() => pieces.forEach((piece) => piece.remove()), 2000);
    return () => {
      window.clearTimeout(cleanup);
      pieces.forEach((piece) => piece.remove());
    };
  }, []);
  return <div ref={host} aria-hidden="true" className={className ?? "pointer-events-none absolute inset-0 overflow-visible"} />;
}
