import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { drawingOfScene } from "./drawing-of-scene";
import { PlanDrawingView } from "./plan-drawing-view";
import { roomWalls, sceneWith, tablePiece } from "./scene-fixture";

describe("PlanDrawingView", () => {
  it("outlines each piece with a thin line, so a round table reads as a table and its number stays legible", () => {
    const drawing = drawingOfScene(sceneWith([...roomWalls(36, 24), tablePiece("t1", { x: 5, y: 5, width: 1.8, depth: 1.8, shape: "round" })]));
    if (!drawing) throw new Error("the fixture room has walls");
    const markup = renderToStaticMarkup(createElement(PlanDrawingView, { drawing, label: "Plan" }));
    const ellipse = markup.match(/<ellipse[^>]*stroke-width="([\d.]+)"/);
    expect(ellipse, "the table outline has no stroke width, so SVG draws it 1 m thick").not.toBeNull();
    // A 1.8 m table: its line stays a small fraction of it rather than swallowing it.
    expect(Number(ellipse![1])).toBeLessThan(1.8 * 0.1);
  });
});
