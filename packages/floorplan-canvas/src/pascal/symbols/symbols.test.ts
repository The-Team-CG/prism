import { describe, expect, it, vi } from "vitest";
import type { FloorplanGeometry } from "@pascal-app/core";
import { FLOORPLAN_SCENE_FORMAT, placeableEventPieceSchemaFor, type FloorplanSceneDocument, type PrismEventPiece, type PrismEventPieceType } from "@prism/types";
import { prismLens, tableFill } from "../lens";
import { lensMarks } from "../shell/lens-marks";
import { eventSymbol } from ".";

const piece = (type: PrismEventPieceType, fields: Record<string, unknown>): PrismEventPiece =>
  placeableEventPieceSchemaFor(type).parse({ type, parentId: "level", position: [4, 0, 6], rotation: 0, width: 1.8, depth: 1.8, ...fields });

/** Every primitive in a symbol, walking into groups. */
function flatten(geometry: FloorplanGeometry): FloorplanGeometry[] {
  return geometry.kind === "group" ? [geometry, ...geometry.children.flatMap(flatten)] : [geometry];
}

const chairs = (geometry: FloorplanGeometry) => flatten(geometry).filter((part) => part.kind === "group" && part.metadata?.part === "chair");
const texts = (geometry: FloorplanGeometry) => flatten(geometry).flatMap((part) => (part.kind === "text" ? [part.text] : []));

describe("event symbols", () => {
  it("draws a table's chairs by its seat count and its number", () => {
    const round = eventSymbol(piece("prism-table", { shape: "round", seats: 8, number: 4 }), "Table");
    expect(chairs(round)).toHaveLength(8);
    expect(texts(round)).toEqual(["T4"]);
    const banquet = eventSymbol(piece("prism-table", { shape: "rect", width: 2.4, depth: 0.75, seats: 7, label: "Family" }), "Table");
    expect(chairs(banquet)).toHaveLength(7);
    expect(texts(banquet)).toEqual(["Family"]);
  });

  it("draws a classroom block's rows × columns of chairs, a stage's steps and a zone's label", () => {
    const classroom = piece("prism-seating-block", { style: "classroom", rows: 3, columns: 4, aisle: 1, width: 3.4, depth: 3.6 });
    expect(chairs(eventSymbol(classroom, "Seating block"))).toHaveLength(12);
    const stage = eventSymbol(piece("prism-stage", { variant: "stage", width: 6, depth: 4, steps: true }), "Stage");
    expect(flatten(stage).filter((part) => part.kind === "group" && part.metadata?.part === "step")).toHaveLength(3);
    expect(texts(eventSymbol(piece("prism-zone", { label: "Catering back of house" }), "Zone"))).toEqual(["Catering back of house"]);
  });

  it("draws chairs in the card's style and the linen in its colour, and shows Pascal's selection outline", () => {
    const dressed = piece("prism-table", { shape: "round", seats: 6, chairStyle: "chiavari", linen: "ivory" });
    const symbol = eventSymbol(dressed, "Table");
    expect(chairs(symbol).map((chair) => (chair.kind === "group" ? chair.metadata?.style : null))).toEqual(Array(6).fill("chiavari"));
    expect(flatten(symbol)).toContainEqual(expect.objectContaining({ kind: "circle", fill: "#f3ecd8" }));
    const selected = eventSymbol(dressed, "Table", { selected: true, palette: { selectedStroke: "#ff00aa" } });
    expect(flatten(selected)).toContainEqual(expect.objectContaining({ stroke: "#ff00aa", pointerEvents: "none" }));
    expect(flatten(symbol)).not.toContainEqual(expect.objectContaining({ pointerEvents: "none" }));
  });

  it("turns every chair's back away from its table, and leaves a crescent's front open", () => {
    /** Where a chair's back points: its +y turned by the plan's clockwise rotate. */
    const backOf = (chair: FloorplanGeometry) => {
      if (chair.kind !== "group") throw new Error("not a chair");
      const turn = chair.transform?.rotate ?? 0;
      const [x, y] = chair.transform?.translate ?? [0, 0];
      return { x, y, back: [-Math.sin(turn), Math.cos(turn)] as const };
    };
    for (const fields of [{ shape: "round", seats: 8 }, { shape: "u-shape", width: 6, depth: 5, seats: 18 }, { shape: "rect", width: 4.8, depth: 1.2, seats: 12, seatSides: "around" }]) {
      const seats = chairs(eventSymbol(piece("prism-table", { ...fields, position: [0, 0, 0] }), "Table"));
      expect(seats.length).toBe(fields.seats);
      for (const { x, y, back } of seats.map(backOf)) expect(back[0] * x + back[1] * y, JSON.stringify(fields)).toBeGreaterThan(0);
    }
    const crescent = chairs(eventSymbol(piece("prism-table", { shape: "round", seats: 6, crescent: true, position: [0, 0, 0] }), "Table")).map(backOf);
    expect(crescent.every(({ y, x }) => y < 0.9 || Math.abs(x) > 0.9)).toBe(true);
  });

  it("places every symbol at the piece's plan position, turned by its rotation", () => {
    for (const type of ["prism-table", "prism-bar", "prism-av"] as const) {
      const symbol = eventSymbol(piece(type, { shape: type === "prism-bar" ? "l" : "round", seats: 6, variant: "led-wall", rotation: Math.PI / 2 }), type);
      expect(symbol).toMatchObject({ kind: "group", transform: { translate: [4, 6], rotate: -Math.PI / 2 } });
    }
  });
});

describe("lenses", () => {
  it("fills a table as empty, part-full or full", () => {
    expect([tableFill(8, 0), tableFill(8, 5), tableFill(8, 8)]).toEqual(["empty", "part", "full"]);
  });

  it("tells subscribers when the lens changes, and only then", () => {
    const heard = vi.fn();
    const stop = prismLens.subscribe(heard);
    prismLens.set("seating");
    prismLens.set("seating");
    expect(heard).toHaveBeenCalledTimes(1);
    expect(prismLens.get()).toBe("seating");
    stop();
    prismLens.set("layout");
  });

  it("colours visible tables by fill and mutes the rest under Seating; emphasises zones under Supplier zones", () => {
    const nodes = [
      piece("prism-table", { id: "full", shape: "round", seats: 2, guestIds: ["a", "b"] }),
      piece("prism-table", { id: "hidden", shape: "round", seats: 2, visible: false }),
      piece("prism-zone", { id: "zone", label: "AV desk" }),
    ];
    const scene: FloorplanSceneDocument = {
      format: FLOORPLAN_SCENE_FORMAT,
      pascalVersion: "1.1.6",
      rootNodeIds: ["level"],
      nodes: Object.fromEntries([{ id: "level", type: "level", parentId: null, visible: true }, ...nodes].map((node) => [node.id, node])),
    };
    const looks = (lens: "layout" | "seating" | "supplier-zones") => Object.fromEntries(lensMarks(scene, lens).map((mark) => [mark.id, mark.look]));
    expect(looks("layout")).toEqual({});
    expect(looks("seating")).toEqual({ full: "full", zone: "muted" });
    expect(looks("supplier-zones")).toEqual({ full: "muted", zone: "zone" });
  });

  it("marks what the layout checks flag under Guest flow, and only sight lines under Sightlines", () => {
    const nodes = [
      piece("prism-table", { id: "a", shape: "round", seats: 8, position: [4, 0, 6] }),
      piece("prism-table", { id: "b", shape: "round", seats: 8, position: [6.5, 0, 6] }),
      piece("prism-table", { id: "c", shape: "round", seats: 8, position: [14, 0, 6] }),
    ];
    const scene: FloorplanSceneDocument = {
      format: FLOORPLAN_SCENE_FORMAT,
      pascalVersion: "1.1.6",
      rootNodeIds: ["level"],
      nodes: Object.fromEntries([{ id: "level", type: "level", parentId: null, visible: true }, ...nodes].map((node) => [node.id, node])),
    };
    const looks = (lens: "sightlines" | "guest-flow") => Object.fromEntries(lensMarks(scene, lens).map((mark) => [mark.id, mark.look]));
    expect(looks("guest-flow")).toEqual({ a: "issue", b: "issue", c: "muted" });
    expect(looks("sightlines")).toEqual({ a: "muted", b: "muted", c: "muted" });
  });
});
