"use client";

import { useSyncExternalStore } from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import { floorplanZoom, useEditor, visibleScene } from "@pascal-app/editor";

/** One click's zoom step: the plan grows or shrinks by a quarter. */
const STEP = 1.25;

const button = "inline-grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground";

/** Zoom out, the zoom against the whole plan, zoom in and fit, floating bottom-right of the plan as in Figma. */
export function ZoomControl() {
  const percent = useSyncExternalStore(floorplanZoom.subscribe, floorplanZoom.percent, floorplanZoom.percent);
  const attached = useSyncExternalStore(floorplanZoom.subscribe, floorplanZoom.attached, () => false);
  const planShown = useEditor((state) => visibleScene(state) === "2d");
  if (!(attached && planShown)) return null;
  return (
    <div
      role="group"
      aria-label="Zoom"
      className="pointer-events-auto absolute bottom-3 right-3 z-20 flex items-center rounded-[11px] bg-background/90 p-[3px] shadow-[0_0_0_1px_rgb(24_19_26/0.08),0_4px_16px_rgb(24_19_26/0.08)] backdrop-blur"
    >
      <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => floorplanZoom.zoomBy(1 / STEP)} className={button}>
        <Minus className="size-3.5" aria-hidden />
      </button>
      <span className="w-11 text-center text-xs font-medium tabular-nums text-foreground">{percent}%</span>
      <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => floorplanZoom.zoomBy(STEP)} className={button}>
        <Plus className="size-3.5" aria-hidden />
      </button>
      <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
      <button type="button" aria-label="Fit the plan" title="Fit the plan" onClick={() => floorplanZoom.fit()} className={button}>
        <Maximize className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
