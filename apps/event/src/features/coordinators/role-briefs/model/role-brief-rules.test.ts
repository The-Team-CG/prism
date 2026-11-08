import { describe, expect, it } from "vitest";
import { callTimeToIso, callTimeToLocalInput } from "./role-brief-rules";

describe("role brief call time", () => {
  it("round-trips a local call time and treats an empty field as no call time", () => {
    const iso = callTimeToIso("2026-12-01T06:30");
    expect(iso).not.toBeNull();
    expect(callTimeToLocalInput(iso)).toBe("2026-12-01T06:30");
    expect(callTimeToIso("")).toBeNull();
    expect(callTimeToLocalInput(null)).toBe("");
  });
});
