import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import { reducer } from "./editor-reducer";
import type { Project } from "./types";

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

describe("floorplan editor project history", () => {
  it("applies layout size changes as undoable project edits", () => {
    const start = initialState(project);
    const changed = reducer(start, { type: "UPDATE_PROJECT", patch: { widthM: 24 } });

    expect(changed.project.widthM).toBe(24);
    expect(reducer(changed, { type: "UNDO" }).project.widthM).toBe(20);
    expect(reducer(reducer(changed, { type: "UNDO" }), { type: "REDO" }).project.widthM).toBe(24);
  });
});