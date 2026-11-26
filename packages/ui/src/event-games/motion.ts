"use client";

import { useEffect, useState } from "react";

/** True when the viewer asked their device for less motion; every game animation then jumps to its end. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * False on the first paint and true just after, so a bar or tile can start from nothing and transition to its
 * value. Static rendering (and reduced motion) gets the final state straight away.
 */
export function useEntered(): boolean {
  const [entered, setEntered] = useState(() => typeof window === "undefined" || prefersReducedMotion());
  useEffect(() => {
    if (entered) return;
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, [entered]);
  return entered;
}

/** Counts from 0 up to `target` over `durationMs`, easing out, for points and tallies landing on screen. */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(() => (typeof window === "undefined" || prefersReducedMotion() ? target : 0));
  useEffect(() => {
    if (prefersReducedMotion() || durationMs <= 0) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(target * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return value;
}
