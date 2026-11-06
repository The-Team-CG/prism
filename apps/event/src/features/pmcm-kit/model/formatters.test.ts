import { describe, expect, it } from "vitest";
import { formatShortDate, humanizeToken, pluralize, sessionDeviceLabel } from "./formatters";
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

  it("pluralizes counts without a parenthesised (s) suffix", () => {
    expect(pluralize(1, "check")).toBe("1 check");
    expect(pluralize(0, "check")).toBe("0 checks");
    expect(pluralize(3, "generated check")).toBe("3 generated checks");
    expect(pluralize(2, "deliverable")).toBe("2 deliverables");
    expect(pluralize(2, "person", "people")).toBe("2 people");
  });

  it("names an unrecorded session device in words", () => {
    expect(sessionDeviceLabel("unknown")).toBe("Unknown device");
    expect(sessionDeviceLabel(null)).toBe("Unknown device");
    expect(sessionDeviceLabel("  ")).toBe("Unknown device");
    expect(sessionDeviceLabel("Chrome on Windows")).toBe("Chrome on Windows");
  });

  it("never shows a raw stored identifier", () => {
    // Older audit rows spell roles with underscores; both spellings name the same actor.
    expect(roleLabel("pmcm_admin")).toBe(roleLabel("pmcm-admin"));
    // Identifiers without a product name still read as words rather than tokens.
    expect(roleLabel("event_day_operator")).toBe("Event day operator");
    expect(floorplanSourceLabel("venue_import")).toBe("Venue import");
    expect(statusLabel("in_review")).toBe("In review");
    expect([roleLabel(null), floorplanSourceLabel(undefined), statusLabel("")]).toEqual(["—", "—", "—"]);
  });
});
