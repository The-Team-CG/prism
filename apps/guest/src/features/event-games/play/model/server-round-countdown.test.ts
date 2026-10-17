import { describe, expect, it } from "vitest";
import { serverRoundSecondsRemaining } from "./server-round-countdown";

describe("serverRoundSecondsRemaining", () => {
  it("counts down from the server timestamp using only monotonic elapsed time", () => {
    expect(serverRoundSecondsRemaining(
      "2026-10-17T10:01:00.000Z",
      "2026-10-17T10:00:15.000Z",
      20_400,
    )).toBe(25);
  });

  it("never returns a negative timer and fails closed for invalid timestamps", () => {
    expect(serverRoundSecondsRemaining(
      "2026-10-17T10:01:00.000Z",
      "2026-10-17T10:00:15.000Z",
      99_000,
    )).toBe(0);
    expect(serverRoundSecondsRemaining("not-a-date", "2026-10-17T10:00:15.000Z", 0)).toBeNull();
    expect(serverRoundSecondsRemaining(null, "2026-10-17T10:00:15.000Z", 0)).toBeNull();
  });
});
