import { describe, expect, it } from "vitest";
import { fittedViewport, handleCanvasDrop, handlePointerDown, handlePointerMove, handlePointerUp } from "./canvas-pointer";
import { initialState } from "./store";
import { reducer } from "./editor-reducer";
import type { CanvasObject, Project } from "./types";

const canvas = {
  getBoundingClientRect: () => ({ left: 0, top: 0 }),
} as unknown as HTMLCanvasElement;

const project: Project = {
  id: "event-1",
  name: "Reception",
  venue: "Hall",
  widthM: 20,
  heightM: 12,
  pax: 80,
  objects: [],
  guests: [],
  suppliers: [],
  updatedAt: 0,
  createdAt: 0,
};

const table: CanvasObject = {
  id: "table-1",
  name: "Round table",
  kind: "ellipse",
  category: "furniture",
  x: 2,
  y: 2,
  w: 2,
  h: 1,
  rotation: 0,
  fill: "#fff",
  stroke: "#000",
  strokeWidth: 0.04,
  seats: 8,
  locked: false,
  hidden: false,
};

function pointerInput(overrides: Partial<Parameters<typeof handlePointerDown>[0]> = {}) {
  return {
    readOnly: false,
    tool: "rect" as const,
    viewport: { tx: 0, ty: 0, zoom: 30 },
    snap: true,
    gridSize: 0.5,
    selectedIds: [],
    hoveredId: null,
    objects: [],
    button: 0,
    altKey: false,
    shiftKey: false,
    clientX: 52,
    clientY: 52,
    canvas,
    ...overrides,
  };
}

describe("floorplan canvas pointer behavior", () => {
  it("selects a table and creates a drawable object through pointer actions", () => {
    const start = initialState({ ...project, objects: [table] });
    const selection = handlePointerDown(pointerInput({
      tool: "select",
      objects: [table],
      clientX: 90,
      clientY: 75,
    }));
    const selected = selection.actions.reduce(reducer, start);

    expect(selected.selectedIds).toEqual([table.id]);

    const draw = handlePointerDown(pointerInput({ tool: "rect" }));
    const created = draw.actions.reduce(reducer, initialState(project));

    expect(created.project.objects).toHaveLength(1);
    expect(created.project.objects[0]).toMatchObject({ kind: "rect", x: 1.5, y: 1.5 });
    expect(draw.pointer.mode).toBe("draw");
  });

  it("undoes and redoes the geometry change from a completed draw gesture", () => {
    const start = initialState(project);
    const down = handlePointerDown(pointerInput({ tool: "rect" }));
    const added = down.actions.reduce(reducer, start);
    const moved = handlePointerMove({
      ...pointerInput({ tool: "rect" }),
      pointer: down.pointer,
      sx: 112,
      sy: 82,
      shiftKey: false,
    });
    const resized = moved.actions.reduce(reducer, added);
    const objectId = down.pointer.drawId;

    expect(resized.project.objects[0]).toMatchObject({ id: objectId, x: 1.5, y: 1.5, w: 2, h: 1 });

    const undone = reducer(resized, { type: "UNDO" });
    const redone = reducer(undone, { type: "REDO" });

    expect(undone.project.objects[0]).toMatchObject({ id: objectId, x: 1.5, y: 1.5, w: 0.01, h: 0.01 });
    expect(redone.project.objects[0]).toMatchObject({ id: objectId, x: 1.5, y: 1.5, w: 2, h: 1 });
  });

  it("keeps pointer edits and dropped assets out of a read-only project", () => {
    const start = initialState(project);
    const down = handlePointerDown(pointerInput({ readOnly: true, tool: "rect" }));
    const moved = handlePointerMove({
      ...pointerInput({ readOnly: true, tool: "rect" }),
      pointer: down.pointer,
      sx: 112,
      sy: 82,
      shiftKey: false,
    });
    const up = handlePointerUp({
      readOnly: true,
      pointer: { ...down.pointer, mode: "marquee" },
      marquee: { x: 22, y: 22, w: 80, h: 80 },
      objects: [table],
      viewport: { tx: 0, ty: 0, zoom: 30 },
    });
    const dropped = handleCanvasDrop({
      readOnly: true,
      clientX: 52,
      clientY: 52,
      canvas,
      viewport: { tx: 0, ty: 0, zoom: 30 },
      objects: [],
      snap: true,
      gridSize: 0.5,
      getData: () => "chair",
    });
    const final = [...down.actions, ...moved.actions, ...up.actions, ...dropped.actions].reduce(reducer, start);

    expect(dropped).toEqual({ prevent: true, actions: [] });
    expect(final.project.objects).toEqual([]);
    expect(final.selectedIds).toEqual([]);
  });
});
describe("floorplan initial view", () => {
  const size = { w: 1000, h: 800 };
  const toScreen = (viewport: { tx: number; zoom: number; ty: number }, x: number, y: number) => ({
    x: viewport.tx + x * viewport.zoom,
    y: viewport.ty + y * viewport.zoom,
  });

  it("frames the drawn objects even when the room is far larger than its contents", () => {
    const viewport = fittedViewport(size, {
      widthM: 1200,
      heightM: 800,
      objects: [{ x: 600, y: 400, w: 4, h: 2 }],
    });
    const topLeft = toScreen(viewport, 600, 400);
    const bottomRight = toScreen(viewport, 604, 402);

    // The object is on screen and big enough to see, not a 2%-zoom speck.
    expect(topLeft.x).toBeGreaterThanOrEqual(0);
    expect(bottomRight.x).toBeLessThanOrEqual(size.w);
    expect(bottomRight.y).toBeLessThanOrEqual(size.h);
    expect(bottomRight.x - topLeft.x).toBeGreaterThan(100);
  });

  it("falls back to the whole room for an empty plan", () => {
    const viewport = fittedViewport(size, { widthM: 20, heightM: 10, objects: [] });
    const roomEnd = toScreen(viewport, 20, 10);
    expect(toScreen(viewport, 0, 0).x).toBeGreaterThan(0);
    expect(roomEnd.x).toBeLessThan(size.w);
  });

  it("refits from the measured canvas when Fit plan is pressed", () => {
    const hall: Project = { ...project, widthM: 1200, heightM: 800, objects: [table] };
    let state = { ...initialState(hall), viewport: { tx: 0, ty: 0, zoom: 0.5 } };
    state = reducer(state, { type: "FIT_TO_PLAN" });
    expect(state.viewport.zoom).toBe(0.5);
    state = reducer(reducer(state, { type: "SET_CANVAS_SIZE", size }), { type: "FIT_TO_PLAN" });
    expect(state.viewport).toEqual(fittedViewport(size, hall));
  });

  it("brings the selected object into view on a large plan, and does nothing without a selection", () => {
    const far = { ...table, id: "far", x: 1100, y: 700 };
    const hall: Project = { ...project, widthM: 1200, heightM: 800, objects: [table, far] };
    let state = reducer({ ...initialState(hall), viewport: { tx: 0, ty: 0, zoom: 0.5 } }, { type: "SET_CANVAS_SIZE", size });
    expect(reducer(state, { type: "FOCUS_SELECTION" }).viewport).toEqual(state.viewport);

    state = reducer(reducer(state, { type: "SET_SELECTION", ids: ["far"] }), { type: "FOCUS_SELECTION" });
    const topLeft = toScreen(state.viewport, far.x, far.y);
    const bottomRight = toScreen(state.viewport, far.x + far.w, far.y + far.h);
    expect(topLeft.x).toBeGreaterThanOrEqual(0);
    expect(bottomRight.x).toBeLessThanOrEqual(size.w);
    expect(bottomRight.y).toBeLessThanOrEqual(size.h);
  });
});
