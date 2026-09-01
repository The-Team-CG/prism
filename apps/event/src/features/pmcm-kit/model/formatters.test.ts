import { describe, expect, it } from "vitest";
import { formatShortDate, humanizeToken } from "./formatters";

describe("pmcm display formatters", () => {
  it("humanizes stored tokens without changing their meaning", () => {
    expect(humanizeToken("pmcm_admin")).toBe("pmcm admin");
  });

  it("formats valid dates and preserves invalid values", () => {
    expect(formatShortDate("2026-01-15T00:00:00.000Z")).toMatch(/Jan 15, 2026/);
    expect(formatShortDate("not-a-date")).toBe("not-a-date");
    expect(formatShortDate()).toBe("No date");
  });
});
