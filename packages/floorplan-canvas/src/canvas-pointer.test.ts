import { describe, expect, it } from "vitest";
import { handleCanvasDrop, handlePointerDown, handlePointerMove, handlePointerUp } from "./canvas-pointer";
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