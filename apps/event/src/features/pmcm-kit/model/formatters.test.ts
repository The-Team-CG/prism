import { describe, expect, it } from "vitest";
import { formatShortDate, humanizeToken } from "./formatters";
import { floorplanSourceLabel, roleLabel, statusLabel } from "./display-labels";

describe("pmcm display formatters", () => {
  it("humanizes stored tokens without changing their meaning", () => {
    expect(humanizeToken("pmcm_admin")).toBe("pmcm admin");
  });

  it("formats valid dates and preserves invalid values", () => {
    expect(formatShortDate("2026-01-15T00:00:00.000Z")).toMatch(/Jan 15, 2026/);
    expect(formatShortDate("not-a-date")).toBe("not-a-date");
    expect(formatShortDate()).toBe("No date");
  });

  it("shows product role, source, and status names instead of stored identifiers", () => {
    expect(roleLabel("pmcm-admin")).toBe("PMCM administrator");
    expect(roleLabel("coordinator")).toBe("Coordinator");
    expect(roleLabel("event_day_operator")).toBe("Event day operator");
    expect(roleLabel(null)).toBe("—");
    expect(floorplanSourceLabel("client_preference")).toBe("Client preference");
    expect(floorplanSourceLabel("template")).toBe("PMCM template");
    expect(statusLabel("in_review")).toBe("In review");
  });
});
