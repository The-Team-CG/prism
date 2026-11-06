import { describe, expect, it } from "vitest";
import { pmcmCalendarQuerySchema } from "./pmcm-overview-inputs.js";

describe("pmcmCalendarQuerySchema", () => {
  it("accepts a bounded window of calendar dates", () => {
    expect(pmcmCalendarQuerySchema.parse({ from: "2026-10-01", to: "2027-11-30" })).toEqual({ from: "2026-10-01", to: "2027-11-30" });
    expect(pmcmCalendarQuerySchema.safeParse({ from: "2026-11-05", to: "2026-11-05" }).success).toBe(true);
  });

  it("rejects reversed, oversized, malformed and unknown inputs", () => {
    expect(pmcmCalendarQuerySchema.safeParse({ from: "2026-11-05", to: "2026-11-04" }).success).toBe(false);
    expect(pmcmCalendarQuerySchema.safeParse({ from: "2020-01-01", to: "2026-11-05" }).success).toBe(false);
    expect(pmcmCalendarQuerySchema.safeParse({ from: "2026-11-05T00:00:00Z", to: "2026-11-06" }).success).toBe(false);
    expect(pmcmCalendarQuerySchema.safeParse({ from: "2026-02-31", to: "2026-03-05" }).success).toBe(false);
    expect(pmcmCalendarQuerySchema.safeParse({ from: "2026-11-01", to: "2026-11-02", page: 1 }).success).toBe(false);
  });
});
