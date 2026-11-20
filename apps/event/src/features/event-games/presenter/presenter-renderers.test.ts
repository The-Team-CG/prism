import { describe, expect, it } from "vitest";
import { PRESENTER_RENDERERS, presenterRendererFor } from "./presenter-renderers";
import GenericPresenterBody from "./renderers/generic-presenter-body";
import PresenterDeckRenderer from "./renderers/presenter-deck";

const ACTIVE_KINDS = [
  "live-trivia", "bingo", "guess-picture", "spin-wheel", "this-or-that", "family-feud",
  "split-the-room", "live-poll", "word-cloud", "open-qa", "presenter-deck",
] as const;

describe("presenterRendererFor", () => {
  it("resolves a renderer for every active multiplayer kind and no other kind", () => {
    expect(Object.keys(PRESENTER_RENDERERS).sort()).toEqual([...ACTIVE_KINDS].sort());
    for (const kind of ACTIVE_KINDS) {
      expect(presenterRendererFor(kind)).toBeTypeOf("function");
    }
    expect(presenterRendererFor("presenter-deck")).toBe(PresenterDeckRenderer);
  });

  it("falls back to the generic body for solo or unknown kinds", () => {
    for (const kind of ["word-scramble", "spot-the-difference", "not-a-game", "toString", ""]) {
      expect(presenterRendererFor(kind)).toBe(GenericPresenterBody);
    }
  });
});
