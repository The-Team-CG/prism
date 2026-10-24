import { describe, expect, it } from "vitest";
import { safeNextPath } from "./navigation.js";

describe("safeNextPath", () => {
  it("keeps same-origin relative paths with their query and hash", () => {
    expect(safeNextPath("/dashboard?tab=files", "/fallback")).toBe("/dashboard?tab=files");
    expect(safeNextPath("/events/42#budget", "/fallback")).toBe("/events/42#budget");
  });

  it.each([
    ["protocol-relative", "//evil.example"],
    ["backslash after slash", "/\\evil.example"],
    ["absolute URL", "https://evil.example"],
    ["javascript scheme", "javascript:alert(1)"],
    ["encoded protocol-relative", "%2F%2Fevil.example"],
    ["embedded tab", "/\t/evil.example"],
    ["embedded newline", "/\n/evil.example"],
    ["empty string", ""],
    ["missing value", null],
  ])("falls back for %s", (_label, raw) => {
    expect(safeNextPath(raw, "/dashboard")).toBe("/dashboard");
  });
});
