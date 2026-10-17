import { describe, expect, it } from "vitest";
import {
  createAnonymousParticipantAlias,
  isActiveMultiplayerGameKind,
  isValidGamePin,
  normalizeGamePin,
} from "./event-game-entry-rules";

describe("event game entry rules", () => {
  it("normalizes surrounding and pasted whitespace without changing PIN characters", () => {
    expect(normalizeGamePin(" 12 34\n56 ")).toBe("123456");
    expect(normalizeGamePin("12-3456")).toBe("12-3456");
  });

  it("accepts only six numeric PIN digits", () => {
    expect(isValidGamePin("123456")).toBe(true);
    expect(isValidGamePin("12345")).toBe(false);
    expect(isValidGamePin("12345x")).toBe(false);
  });

  it("classifies only Active (Multiplayer) game kinds for PIN joining", () => {
    expect(isActiveMultiplayerGameKind("live-trivia")).toBe(true);
    expect(isActiveMultiplayerGameKind("split-the-room")).toBe(true);
    expect(isActiveMultiplayerGameKind("word-scramble")).toBe(false);
    expect(isActiveMultiplayerGameKind("spot-the-difference")).toBe(false);
  });

  it("creates a non-identifying guest alias", () => {
    const alias = createAnonymousParticipantAlias("event-scoped-credential");
    expect(alias).toMatch(/^Guest \d{4}$/);
    expect(alias).not.toContain("@");
    expect(createAnonymousParticipantAlias("event-scoped-credential")).toBe(alias);
  });
});
