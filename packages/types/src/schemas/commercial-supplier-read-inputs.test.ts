import { describe, expect, it } from "vitest";
import {
  pmcmSupplierDirectoryQuerySchema,
  pmcmSupplierHistoryQuerySchema,
  pmcmSupplierProfileQuerySchema,
  pmcmSupplierRecordsQuerySchema,
} from "./commercial-supplier-read-inputs.js";

describe("PMCM supplier read query schemas", () => {
  it("normalizes empty query parameters to directory defaults", () => {
    expect(pmcmSupplierDirectoryQuerySchema.parse({})).toEqual({
      q: "",
      rating: "all",
      sort: "name",
      direction: "asc",
      page: 0,
      pageSize: 25,
    });
  });

  it("trims search and converts bounded pagination query strings", () => {
    expect(pmcmSupplierDirectoryQuerySchema.parse({
      q: "  Acme AV  ",
      page: "2",
      pageSize: "50",
      sort: "rating",
      direction: "desc",
    })).toEqual({
      q: "Acme AV",
      rating: "all",
      sort: "rating",
      direction: "desc",
      page: 2,
      pageSize: 50,
    });
  });

  it.each([
    [{ page: "-1" }],
    [{ page: "1001" }],
    [{ pageSize: "51" }],
    [{ sort: "pipeline-value" }],
    [{ direction: "sideways" }],
    [{ rating: "88%" }],
    [{ tier: "strategic" }],
    [{ q: "x".repeat(121) }],
    [{ actorRole: "pmcm-admin" }],
  ])("rejects invalid or unrelated query values %j", (query) => {
    expect(pmcmSupplierDirectoryQuerySchema.safeParse(query).success).toBe(false);
  });

  it("bounds and defaults history pagination", () => {
    expect(pmcmSupplierHistoryQuerySchema.parse({ page: "1", pageSize: "50" })).toEqual({
      page: 1,
      pageSize: 50,
    });
    expect(pmcmSupplierHistoryQuerySchema.safeParse({ pageSize: 100 }).success).toBe(false);
  });

  it("defaults supplier scorecards to all time and rejects unknown periods", () => {
    expect(pmcmSupplierProfileQuerySchema.parse({})).toEqual({ period: "all" });
    expect(pmcmSupplierProfileQuerySchema.parse({ period: "90d" })).toEqual({ period: "90d" });
    expect(pmcmSupplierProfileQuerySchema.safeParse({ period: "7d" }).success).toBe(false);
  });

  it("defaults record history to 30 days with bounded pagination", () => {
    expect(pmcmSupplierRecordsQuerySchema.parse({})).toEqual({
      period: "30d",
      page: 0,
      pageSize: 25,
    });
  });
});
