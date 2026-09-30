import type { CanvasObject, Tool, Viewport } from "./types";

export const RULER_SIZE = 22;

export interface ScreenPoint {
  sx: number;
  sy: number;
}

export interface WorldPoint {
  x: number;
  y: number;
}

export interface WorldBounds {
  left: number;
  right: number;
  top: number;
  bot: number;
}

export function isDrawTool(tool: Tool): tool is "rect" | "ellipse" | "line" {
  if (tool === "rect") return true;
  if (tool === "ellipse") return true;
  return tool === "line";
}

export function canvasCursor(tool: Tool, readOnly = false): string {
  if (readOnly) return "grab";
  if (tool === "hand") return "grab";
  if (isDrawTool(tool)) return "crosshair";
  return "default";
}

export function toWorld(sx: number, sy: number, viewport: Viewport): WorldPoint {
  return { x: (sx - viewport.tx) / viewport.zoom, y: (sy - viewport.ty) / viewport.zoom };
}

export function snapCoord(value: number, snap: boolean, gridSize: number): number {
  if (!snap) return value;
  return Math.round(value / gridSize) * gridSize;
}

export function clientToLocal(
  e: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
): ScreenPoint {
  const rect = canvas.getBoundingClientRect();
  return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
}

export function visibleWorldBounds(size: { w: number; h: number }, viewport: Viewport): WorldBounds {
  return {
    left: (0 - viewport.tx) / viewport.zoom,
    right: (size.w - viewport.tx) / viewport.zoom,
    top: (0 - viewport.ty) / viewport.zoom,
    bot: (size.h - viewport.ty) / viewport.zoom,
  };
}

export function hitTest(o: CanvasObject, wx: number, wy: number): boolean {
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  const dx = wx - cx;
  const dy = wy - cy;
  const cos = Math.cos(-o.rotation);
  const sin = Math.sin(-o.rotation);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) <= o.w / 2 && Math.abs(ly) <= o.h / 2;
}

export function findTopHit(objects: CanvasObject[], wx: number, wy: number): CanvasObject | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    if (hitTest(objects[i], wx, wy)) return objects[i];
  }
  return null;
}

export function findTopUnlockedHit(
  objects: CanvasObject[],
  wx: number,
  wy: number,
): CanvasObject | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o.hidden || o.locked) continue;
    if (hitTest(o, wx, wy)) return o;
  }
  return null;
}

export function findTopUnlockedSeatedHit(
  objects: CanvasObject[],
  wx: number,
  wy: number,
): CanvasObject | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o.hidden || o.locked) continue;
    if (o.seats === undefined) continue;
    if (hitTest(o, wx, wy)) return o;
  }
  return null;
}

function selectionHandles(o: CanvasObject, zoom: number): [string, number, number][] {
  return [
    ["nw", -o.w / 2, -o.h / 2],
    ["n", 0, -o.h / 2],
    ["ne", o.w / 2, -o.h / 2],
    ["w", -o.w / 2, 0],
    ["e", o.w / 2, 0],
    ["sw", -o.w / 2, o.h / 2],
    ["s", 0, o.h / 2],
    ["se", o.w / 2, o.h / 2],
    ["rot", 0, -o.h / 2 - 22 / zoom],
  ];
}

function hitHandleName(o: CanvasObject, sx: number, sy: number, viewport: Viewport): string | null {
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  const handles = selectionHandles(o, viewport.zoom);
  const cos = Math.cos(o.rotation);
  const sin = Math.sin(o.rotation);
  const hs = 10 / viewport.zoom;
  const mouse = toWorld(sx, sy, viewport);
  for (const [name, hx, hy] of handles) {
    const wx = cx + hx * cos - hy * sin;
    const wy = cy + hx * sin + hy * cos;
    if (Math.abs(mouse.x - wx) < hs && Math.abs(mouse.y - wy) < hs) return name;
  }
  return null;
}

export function getHandleAt(
  sx: number,
  sy: number,
  selectedIds: string[],
  objects: CanvasObject[],
  viewport: Viewport,
): string | null {
  if (selectedIds.length !== 1) return null;
  const o = objects.find((x) => x.id === selectedIds[0]);
  if (!o) return null;
  return hitHandleName(o, sx, sy, viewport);
}
