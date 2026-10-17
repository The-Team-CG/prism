import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PrismEventGameDefinition } from "@prism/types";
import { EventGameTemplateConfigurationEditor, hasPublishableTemplateConfiguration } from "./event-game-template-configuration-editor";

function game(kind: PrismEventGameDefinition["kind"], configuration: Record<string, unknown>): PrismEventGameDefinition {
  return {
    id: "game-1", eventId: "event-1", slug: "hosted-game", title: "Hosted game", kind,
    entryMode: "active", status: "draft", version: 1, config: { configuration },
    availableFrom: null, availableUntil: null,
  };
}

describe("EventGameTemplateConfigurationEditor social templates", () => {
  it("edits This or That prompts and two choices", () => {
    const definition = game("this-or-that", {
      kind: "this-or-that",
      rounds: [{ key: "round-1", prompt: "Tea or coffee?", options: ["Tea", "Coffee"], durationSeconds: 30 }],
    });

    const markup = renderToStaticMarkup(createElement(EventGameTemplateConfigurationEditor, {
      game: definition, busy: false, onSave: vi.fn(), onUploadMedia: vi.fn().mockResolvedValue({ objectId: "obj_123e4567-e89b-42d3-a456-426614174000" }),
    }));

    expect(markup).toContain("Choices (exactly two, one per line)");
    expect(markup).toContain("Tea\nCoffee");
    expect(hasPublishableTemplateConfiguration(definition)).toBe(true);
  });

  it("edits Family Feud teams and host-accepted answer alternatives without rendering team IDs", () => {
    const teamId = "a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5";
    const definition = game("family-feud", {
      kind: "family-feud",
      teams: [{ id: teamId, label: "Blue" }, { id: "a78bde2c-61a4-4e5f-b9ba-dbe21ca203b6", label: "Gold" }],
      rounds: [{
        key: "round-1", prompt: "Name a fruit.", durationSeconds: 60,
        answers: [{ answer: "Mango", alternatives: ["Mangga"], points: 10 }],
      }],
    });

    const markup = renderToStaticMarkup(createElement(EventGameTemplateConfigurationEditor, {
      game: definition, busy: false, onSave: vi.fn(), onUploadMedia: vi.fn().mockResolvedValue({ objectId: "obj_123e4567-e89b-42d3-a456-426614174000" }),
    }));

    expect(markup).toContain("Answer board: answer | accepted alternatives | points");
    expect(markup).toContain("Mango | Mangga | 10");
    expect(markup).toContain("Blue");
    expect(markup).not.toContain(teamId);
    expect(hasPublishableTemplateConfiguration(definition)).toBe(true);
  });

  it("edits Split the Room text bounds and aggregate choices", () => {
    const definition = game("split-the-room", {
      kind: "split-the-room",
      rounds: [{
        key: "round-1", prompt: "Would you rather?", leftLabel: "Left", rightLabel: "Right",
        maxResponseLength: 160, durationSeconds: 60,
      }],
    });

    const markup = renderToStaticMarkup(createElement(EventGameTemplateConfigurationEditor, {
      game: definition, busy: false, onSave: vi.fn(), onUploadMedia: vi.fn().mockResolvedValue({ objectId: "obj_123e4567-e89b-42d3-a456-426614174000" }),
    }));

    expect(markup).toContain("Left choice");
    expect(markup).toContain("Right choice");
    expect(markup).toContain("Maximum response length");
    expect(hasPublishableTemplateConfiguration(definition)).toBe(true);
  });

  it("edits Word Scramble rounds and validates the saved answer key", () => {
    const definition = game("word-scramble", {
      kind: "word-scramble",
      rounds: [{ key: "word-1", scrambledWord: "tac", answer: "cat", points: 20, durationSeconds: 45 }],
    });

    const markup = renderToStaticMarkup(createElement(EventGameTemplateConfigurationEditor, {
      game: definition, busy: false, onSave: vi.fn(), onUploadMedia: vi.fn().mockResolvedValue({ objectId: "obj_123e4567-e89b-42d3-a456-426614174000" }),
    }));

    expect(markup).toContain("Scrambled word");
    expect(markup).toContain("Answer key (not shown to guests)");
    expect(markup).toContain("tac");
    expect(markup).toContain("cat");
    expect(hasPublishableTemplateConfiguration(definition)).toBe(true);
  });

  it("edits Singleplayer Picture rounds and reveal hints", () => {
    const definition = game("guess-picture-solo", {
      kind: "guess-picture-solo",
      rounds: [{
        key: "picture-1", mediaObjectId: "obj_123e4567-e89b-42d3-a456-426614174000",
        acceptedAnswers: ["Arctic fox"],
        stages: [{ afterSeconds: 0, hint: "An animal", points: 20 }, { afterSeconds: 15, hint: "It lives in the north", points: 10 }],
        durationSeconds: 60,
      }],
    });

    const markup = renderToStaticMarkup(createElement(EventGameTemplateConfigurationEditor, {
      game: definition, busy: false, onSave: vi.fn(), onUploadMedia: vi.fn().mockResolvedValue({ objectId: "obj_123e4567-e89b-42d3-a456-426614174000" }),
    }));

    expect(markup).toContain("Picture image (PNG or JPEG, up to 8 MB)");
    expect(markup).toContain("Accepted answers");
    expect(markup).toContain("Reveal hint");
    expect(markup).toContain("It lives in the north");
    expect(hasPublishableTemplateConfiguration(definition)).toBe(true);
  });

  it("edits Spot the Difference image pairs and bounded target regions", () => {
    const definition = game("spot-the-difference", {
      kind: "spot-the-difference",
      rounds: [{
        key: "difference-1", originalMediaObjectId: "obj_123e4567-e89b-42d3-a456-426614174000",
        comparisonMediaObjectId: "obj_123e4567-e89b-42d3-a456-426614174001",
        differences: [{ x: 0.2, y: 0.3, width: 0.1, height: 0.1, points: 10 }], durationSeconds: 90,
      }],
    });

    const markup = renderToStaticMarkup(createElement(EventGameTemplateConfigurationEditor, {
      game: definition, busy: false, onSave: vi.fn(), onUploadMedia: vi.fn().mockResolvedValue({ objectId: "obj_123e4567-e89b-42d3-a456-426614174000" }),
    }));

    expect(markup).toContain("Original image (PNG or JPEG, up to 8 MB)");
    expect(markup).toContain("Comparison image (PNG or JPEG, up to 8 MB)");
    expect(markup).toContain("Target regions (x, y, width, height, points)");
    expect(markup).toContain("0.2, 0.3, 0.1, 0.1, 10");
    expect(hasPublishableTemplateConfiguration(definition)).toBe(true);
  });

  it("edits Would You Rather prompts with organizer-controlled anonymous aggregation", () => {
    const definition = game("would-you-rather", {
      kind: "would-you-rather",
      rounds: [{ key: "rather-1", prompt: "Would you rather?", options: ["Fly", "Be invisible"], durationSeconds: 45, aggregateResults: false }],
    });

    const markup = renderToStaticMarkup(createElement(EventGameTemplateConfigurationEditor, {
      game: definition, busy: false, onSave: vi.fn(), onUploadMedia: vi.fn().mockResolvedValue({ objectId: "obj_123e4567-e89b-42d3-a456-426614174000" }),
    }));

    expect(markup).toContain("Would you rather");
    expect(markup).toContain("Allow anonymous event poll totals");
    expect(markup).toContain("Be invisible");
    expect(hasPublishableTemplateConfiguration(definition)).toBe(true);
  });

  it("edits This or That (Solo) prompts and explains guest opt-in poll sharing", () => {
    const definition = game("this-or-that-solo", {
      kind: "this-or-that-solo",
      rounds: [{ key: "choice-1", prompt: "Tea or coffee?", options: ["Tea", "Coffee"], durationSeconds: 45 }],
    });

    const markup = renderToStaticMarkup(createElement(EventGameTemplateConfigurationEditor, {
      game: definition, busy: false, onSave: vi.fn(), onUploadMedia: vi.fn().mockResolvedValue({ objectId: "obj_123e4567-e89b-42d3-a456-426614174000" }),
    }));

    expect(markup).toContain("Private This or That (Solo)");
    expect(markup).toContain("Guests choose whether to share each answer in the event poll.");
    expect(markup).toContain("Tea");
    expect(hasPublishableTemplateConfiguration(definition)).toBe(true);
  });
});
