import type { Action } from "./editor-reducer";
import type { CanvasObject, Tool, Viewport } from "./types";
import { ASSETS, assetToObject } from "./assetLibrary";
import {
  RULER_SIZE,
  canvasCursor,
  clientToLocal,
  findTopHit,
  findTopUnlockedHit,
  findTopUnlockedSeatedHit,
  getHandleAt,
  isDrawTool,
  snapCoord as snapValue,
  toWorld,
} from "./canvas-geometry";

export { canvasCursor, RULER_SIZE };

export interface PointerState {
  mode: "none" | "pan" | "drag" | "marquee" | "resize" | "rotate" | "draw";
  startX: number;
  startY: number;
  startWorld: { x: number; y: number };
  origObjects?: CanvasObject[];
  resizeHandle?: string;
  drawId?: string;
}

export const IDLE_POINTER: PointerState = {
  mode: "none",
  startX: 0,
  startY: 0,
  startWorld: { x: 0, y: 0 },
};

const DRAW_NAMES: Record<"rect" | "ellipse" | "line", string> = {
  rect: "Rectangle",
  ellipse: "Ellipse",
  line: "Line",
};

const CANVAS_DRAG_TYPES = [
  "application/x-prism-asset",
  "application/x-prism-guest",
  "application/x-prism-supplier",
];

export function hasCanvasDragType(types: readonly string[]) {
  return CANVAS_DRAG_TYPES.some((type) => types.includes(type));
}

export interface PointerSession {
  readOnly: boolean;
  tool: Tool;
  viewport: Viewport;
  snap: boolean;
  gridSize: number;
  selectedIds: string[];
  hoveredId: string | null;
  objects: CanvasObject[];
}

export interface PointerDownInput extends PointerSession {
  button: number;
  altKey: boolean;
  shiftKey: boolean;
  clientX: number;
  clientY: number;
  canvas: HTMLCanvasElement;
}

export interface PointerResult {
  kind: "ignore" | "capture";
  pointer: PointerState;
  actions: Action[];
}

function panState(sx: number, sy: number, world: { x: number; y: number }): PointerState {
  return { mode: "pan", startX: sx, startY: sy, startWorld: world };
}

function createDrawObject(
  tool: "rect" | "ellipse" | "line",
  world: { x: number; y: number },
  snap: boolean,
  gridSize: number,
): CanvasObject {
  return {
    id: `draw_${Date.now()}`,
    name: DRAW_NAMES[tool],
    kind: tool,
    category: "architecture",
    x: snapValue(world.x, snap, gridSize),
    y: snapValue(world.y, snap, gridSize),
    w: 0.01,
    h: 0.01,
    rotation: 0,
    fill: tool === "line" ? "#C01867" : "#CCECF4",
    stroke: "#c01867",
    strokeWidth: 0.04,
    locked: false,
    hidden: false,
  };
}

function tryBeginPan(input: PointerDownInput, sx: number, sy: number, world: { x: number; y: number }): PointerResult | null {
  if (input.readOnly || input.tool === "hand" || input.button === 1 || input.altKey) {
    return { kind: "capture", pointer: panState(sx, sy, world), actions: [] };
  }
  return null;
}

function tryBeginHandle(input: PointerDownInput, sx: number, sy: number, world: { x: number; y: number }): PointerResult | null {
  const handle = getHandleAt(sx, sy, input.selectedIds, input.objects, input.viewport);
  if (!handle) return null;
  if (handle === "rot") {
    const sel = input.objects.find((item) => input.selectedIds.includes(item.id));
    return {
      kind: "capture",
      pointer: { mode: "rotate", startX: sx, startY: sy, startWorld: world, origObjects: sel ? [sel] : [] },
      actions: [],
    };
  }
  const sel = input.objects.filter((item) => input.selectedIds.includes(item.id));
  return {
    kind: "capture",
    pointer: { mode: "resize", startX: sx, startY: sy, startWorld: world, resizeHandle: handle, origObjects: sel },
    actions: [],
  };
}

function tryBeginDraw(input: PointerDownInput, sx: number, sy: number, world: { x: number; y: number }): PointerResult | null {
  if (!isDrawTool(input.tool)) return null;
  const obj = createDrawObject(input.tool, world, input.snap, input.gridSize);
  return {
    kind: "capture",
    pointer: { mode: "draw", startX: sx, startY: sy, startWorld: world, drawId: obj.id },
    actions: [{ type: "ADD_OBJECT", obj }],
  };
}

function tryBeginHit(input: PointerDownInput, sx: number, sy: number, world: { x: number; y: number }): PointerResult | null {
  const hit = findTopUnlockedHit(input.objects, world.x, world.y);
  if (!hit) return null;
  const already = input.selectedIds.includes(hit.id);
  const actions: Action[] = [];
  if (input.shiftKey) actions.push({ type: "ADD_SELECTION", id: hit.id });
  else if (!already) actions.push({ type: "SET_SELECTION", ids: [hit.id] });
  const toMove = already ? input.objects.filter((item) => input.selectedIds.includes(item.id)) : [hit];
  return {
    kind: "capture",
    pointer: { mode: "drag", startX: sx, startY: sy, startWorld: world, origObjects: toMove.map((item) => ({ ...item })) },
    actions,
  };
}

export function handlePointerDown(input: PointerDownInput): PointerResult {
  if (input.button !== 0 && input.button !== 1) {
    return { kind: "ignore", pointer: IDLE_POINTER, actions: [] };
  }
  const { sx, sy } = clientToLocal(input, input.canvas);
  if (sx < RULER_SIZE || sy < RULER_SIZE) {
    return { kind: "ignore", pointer: IDLE_POINTER, actions: [] };
  }
  const world = toWorld(sx, sy, input.viewport);
  return (
    tryBeginPan(input, sx, sy, world) ??
    tryBeginHandle(input, sx, sy, world) ??
    tryBeginDraw(input, sx, sy, world) ??
    tryBeginHit(input, sx, sy, world) ??
    beginMarquee(input, sx, sy, world)
  );
}

function beginMarquee(input: PointerDownInput, sx: number, sy: number, world: { x: number; y: number }): PointerResult {
  const actions: Action[] = input.shiftKey ? [] : [{ type: "SET_SELECTION", ids: [] }];
  return {
    kind: "capture",
    pointer: { mode: "marquee", startX: sx, startY: sy, startWorld: world },
    actions,
  };
}

export interface PointerMoveInput extends PointerSession {
  pointer: PointerState;
  sx: number;
  sy: number;
  shiftKey: boolean;
}

export interface PointerMoveResult {
  pointer?: PointerState;
  actions: Action[];
  marquee?: { x: number; y: number; w: number; h: number } | null;
}

const EMPTY_MOVE: PointerMoveResult = { actions: [] };

function handleHoverMove(input: PointerMoveInput): PointerMoveResult {
  const world = toWorld(input.sx, input.sy, input.viewport);
  const hit = findTopHit(input.objects, world.x, world.y);
  const hitId = hit?.id ?? null;
  if (hitId === input.hoveredId) return EMPTY_MOVE;
  return { actions: [{ type: "HOVER", id: hitId }] };
}

function handlePanMove(input: PointerMoveInput): PointerMoveResult {
  const p = input.pointer;
  return {
    pointer: { ...p, startX: input.sx, startY: input.sy },
    actions: [
      {
        type: "SET_VIEWPORT",
        viewport: { tx: input.viewport.tx + (input.sx - p.startX), ty: input.viewport.ty + (input.sy - p.startY) },
      },
    ],
  };
}

function handleMarqueeMove(input: PointerMoveInput): PointerMoveResult {
  if (input.readOnly) return EMPTY_MOVE;
  const p = input.pointer;
  return {
    actions: [],
    marquee: {
      x: Math.min(input.sx, p.startX),
      y: Math.min(input.sy, p.startY),
      w: Math.abs(input.sx - p.startX),
      h: Math.abs(input.sy - p.startY),
    },
  };
}

function handleDragMove(input: PointerMoveInput): PointerMoveResult {
  if (input.readOnly || !input.pointer.origObjects) return EMPTY_MOVE;
  const world = toWorld(input.sx, input.sy, input.viewport);
  const dx = world.x - input.pointer.startWorld.x;
  const dy = world.y - input.pointer.startWorld.y;
  const patches = input.pointer.origObjects.map((item) => ({
    id: item.id,
    patch: {
      x: snapValue(item.x + dx, input.snap, input.gridSize),
      y: snapValue(item.y + dy, input.snap, input.gridSize),
    },
  }));
  return { actions: [{ type: "UPDATE_OBJECTS", patches }] };
}

function handleDrawMove(input: PointerMoveInput): PointerMoveResult {
  if (input.readOnly || !input.pointer.drawId) return EMPTY_MOVE;
  const world = toWorld(input.sx, input.sy, input.viewport);
  const x0 = input.pointer.startWorld.x;
  const y0 = input.pointer.startWorld.y;
  return {
    actions: [
      {
        type: "UPDATE_OBJECT",
        id: input.pointer.drawId,
        patch: {
          x: snapValue(Math.min(x0, world.x), input.snap, input.gridSize),
          y: snapValue(Math.min(y0, world.y), input.snap, input.gridSize),
          w: snapValue(Math.max(0.1, Math.abs(world.x - x0)), input.snap, input.gridSize),
          h: snapValue(Math.max(0.1, Math.abs(world.y - y0)), input.snap, input.gridSize),
        },
      },
    ],
  };
}

export function resizedBox(
  original: CanvasObject,
  handle: string,
  dx: number,
  dy: number,
): Pick<CanvasObject, "x" | "y" | "w" | "h"> {
  let { x, y, w, h } = original;
  if (handle.includes("e")) w = Math.max(0.1, original.w + dx);
  if (handle.includes("s")) h = Math.max(0.1, original.h + dy);
  if (handle.includes("w")) {
    w = Math.max(0.1, original.w - dx);
    x = original.x + dx;
  }
  if (handle.includes("n")) {
    h = Math.max(0.1, original.h - dy);
    y = original.y + dy;
  }
  return { x, y, w, h };
}

function handleResizeMove(input: PointerMoveInput): PointerMoveResult {
  if (input.readOnly || !input.pointer.origObjects || !input.pointer.resizeHandle) return EMPTY_MOVE;
  const original = input.pointer.origObjects[0];
  if (!original) return EMPTY_MOVE;
  const world = toWorld(input.sx, input.sy, input.viewport);
  const box = resizedBox(
    original,
    input.pointer.resizeHandle,
    world.x - input.pointer.startWorld.x,
    world.y - input.pointer.startWorld.y,
  );
  return {
    actions: [
      {
        type: "UPDATE_OBJECT",
        id: original.id,
        patch: {
          x: snapValue(box.x, input.snap, input.gridSize),
          y: snapValue(box.y, input.snap, input.gridSize),
          w: snapValue(box.w, input.snap, input.gridSize),
          h: snapValue(box.h, input.snap, input.gridSize),
        },
      },
    ],
  };
}

function handleRotateMove(input: PointerMoveInput): PointerMoveResult {
  if (input.readOnly || !input.pointer.origObjects) return EMPTY_MOVE;
  const original = input.pointer.origObjects[0];
  if (!original) return EMPTY_MOVE;
  const world = toWorld(input.sx, input.sy, input.viewport);
  const cx = original.x + original.w / 2;
  const cy = original.y + original.h / 2;
  const ang = Math.atan2(world.y - cy, world.x - cx) + Math.PI / 2;
  const rotation = input.shiftKey ? Math.round(ang / (Math.PI / 12)) * (Math.PI / 12) : ang;
  return { actions: [{ type: "UPDATE_OBJECT", id: original.id, patch: { rotation } }] };
}

const MOVE_HANDLERS: Record<PointerState["mode"], (input: PointerMoveInput) => PointerMoveResult> = {
  none: handleHoverMove,
  pan: handlePanMove,
  marquee: handleMarqueeMove,
  drag: handleDragMove,
  draw: handleDrawMove,
  resize: handleResizeMove,
  rotate: handleRotateMove,
};

export function handlePointerMove(input: PointerMoveInput): PointerMoveResult {
  return MOVE_HANDLERS[input.pointer.mode](input);
}

export function marqueeSelectionIds(
  objects: CanvasObject[],
  marquee: { x: number; y: number; w: number; h: number },
  viewport: Viewport,
): string[] {
  const x0 = (marquee.x - viewport.tx) / viewport.zoom;
  const y0 = (marquee.y - viewport.ty) / viewport.zoom;
  const x1 = x0 + marquee.w / viewport.zoom;
  const y1 = y0 + marquee.h / viewport.zoom;
  return objects
    .filter((item) => {
      const cx = item.x + item.w / 2;
      const cy = item.y + item.h / 2;
      return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
    })
    .map((item) => item.id);
}

export function handlePointerUp(input: {
  readOnly: boolean;
  pointer: PointerState;
  marquee: { x: number; y: number; w: number; h: number } | null;
  objects: CanvasObject[];
  viewport: Viewport;
}): { actions: Action[]; clearMarquee: boolean } {
  if (!input.readOnly && input.pointer.mode === "marquee" && input.marquee) {
    return {
      actions: [{ type: "SET_SELECTION", ids: marqueeSelectionIds(input.objects, input.marquee, input.viewport) }],
      clearMarquee: true,
    };
  }
  return { actions: [], clearMarquee: false };
}

export function wheelViewportPatch(
  e: { ctrlKey: boolean; metaKey: boolean; clientX: number; clientY: number; deltaX: number; deltaY: number; deltaMode: number },
  canvas: HTMLCanvasElement,
  viewport: Viewport,
  sizeH: number,
): Partial<Viewport> | null {
  if (e.ctrlKey || e.metaKey) {
    return zoomViewportPatch(e, canvas, viewport, sizeH);
  }
  return {
    tx: viewport.tx - toPixelDelta(e.deltaX, e.deltaMode, sizeH),
    ty: viewport.ty - toPixelDelta(e.deltaY, e.deltaMode, sizeH),
  };
}

function toPixelDelta(delta: number, deltaMode: number, sizeH: number): number {
  if (deltaMode === 1) return delta * 16;
  if (deltaMode === 2) return delta * sizeH;
  return delta;
}

function zoomViewportPatch(
  e: { clientX: number; clientY: number; deltaY: number; deltaMode: number },
  canvas: HTMLCanvasElement,
  viewport: Viewport,
  sizeH: number,
): Partial<Viewport> | null {
  const { sx, sy } = clientToLocal(e, canvas);
  const factor = Math.exp(-toPixelDelta(e.deltaY, e.deltaMode, sizeH) * 0.002);
  const newZoom = Math.min(400, Math.max(5, viewport.zoom * factor));
  if (Math.abs(newZoom - viewport.zoom) < 0.0001) return null;
  const wx = (sx - viewport.tx) / viewport.zoom;
  const wy = (sy - viewport.ty) / viewport.zoom;
  return { zoom: newZoom, tx: sx - wx * newZoom, ty: sy - wy * newZoom };
}

export interface DropResult {
  prevent: boolean;
  actions: Action[];
}

function tryDropSupplier(supplierId: string, world: { x: number; y: number }, objects: CanvasObject[]): DropResult | null {
  if (!supplierId) return null;
  const hit = findTopUnlockedHit(objects, world.x, world.y);
  if (!hit) return { prevent: true, actions: [] };
  return {
    prevent: true,
    actions: [
      { type: "ASSIGN_SUPPLIER", supplierId, objectId: hit.id },
      { type: "SET_SELECTION", ids: [hit.id] },
    ],
  };
}

function tryDropGuest(guestId: string, world: { x: number; y: number }, objects: CanvasObject[]): DropResult | null {
  if (!guestId) return null;
  const hit = findTopUnlockedSeatedHit(objects, world.x, world.y);
  if (!hit) return { prevent: true, actions: [] };
  return {
    prevent: true,
    actions: [
      { type: "ASSIGN_GUEST", guestId, objectId: hit.id },
      { type: "SET_SELECTION", ids: [hit.id] },
    ],
  };
}

function tryDropAsset(assetId: string, world: { x: number; y: number }, snap: boolean, gridSize: number): DropResult {
  if (!assetId) return { prevent: false, actions: [] };
  const asset = ASSETS.find((item) => item.id === assetId);
  if (!asset) return { prevent: true, actions: [] };
  const obj = assetToObject(asset, snapValue(world.x, snap, gridSize), snapValue(world.y, snap, gridSize));
  return { prevent: true, actions: [{ type: "ADD_OBJECT", obj }] };
}

export function handleCanvasDrop(input: {
  readOnly: boolean;
  clientX: number;
  clientY: number;
  canvas: HTMLCanvasElement;
  viewport: Viewport;
  objects: CanvasObject[];
  snap: boolean;
  gridSize: number;
  getData: (type: string) => string;
}): DropResult {
  if (input.readOnly) return { prevent: true, actions: [] };
  const { sx, sy } = clientToLocal(input, input.canvas);
  const world = toWorld(sx, sy, input.viewport);
  return (
    tryDropSupplier(input.getData("application/x-prism-supplier"), world, input.objects) ??
    tryDropGuest(input.getData("application/x-prism-guest"), world, input.objects) ??
    tryDropAsset(input.getData("application/x-prism-asset"), world, input.snap, input.gridSize)
  );
}

export function fittedViewport(size: { w: number; h: number }, project: { widthM: number; heightM: number }): Viewport {
  const pad = 90;
  const zoom = Math.min((size.w - pad * 2) / project.widthM, (size.h - pad * 2) / project.heightM);
  return {
    zoom,
    tx: (size.w - project.widthM * zoom) / 2,
    ty: (size.h - project.heightM * zoom) / 2,
  };
}
