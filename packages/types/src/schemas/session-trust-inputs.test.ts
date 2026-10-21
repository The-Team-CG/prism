import { describe, expect, it } from "vitest";
import {
  assignPrivacyRequestSchema,
  executePrivacyRequestSchema,
  listPrivacyRequestsQuerySchema,
  privacyCorrectionPatchSchema,
} from "./session-trust-inputs.js";

describe("privacy correction patch", () => {
  it("accepts a single identity or contact field and rejects unknown, empty, or malformed patches", () => {
    expect(privacyCorrectionPatchSchema.safeParse({ name: "  Ana Reyes  " }).success).toBe(true);
    expect(privacyCorrectionPatchSchema.safeParse({ email: "ana@ayala.test" }).success).toBe(true);

    expect(privacyCorrectionPatchSchema.safeParse({}).success).toBe(false);
    expect(privacyCorrectionPatchSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(privacyCorrectionPatchSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(privacyCorrectionPatchSchema.safeParse({ name: "Ana", role: "pmcm-admin" }).success).toBe(false);
    expect(privacyCorrectionPatchSchema.safeParse({ name: "Ana", normalizedEmail: "x@y.test" }).success).toBe(false);
  });

  it("carries the correction patch only as an optional part of the execution input", () => {
    expect(executePrivacyRequestSchema.parse({ executionNotes: "done" })).toEqual({ executionNotes: "done" });
    expect(executePrivacyRequestSchema.safeParse({ correction: { email: "ana@ayala.test", clientName: "x" } }).success).toBe(false);
    expect(executePrivacyRequestSchema.safeParse({ correction: { name: "Ana Reyes" } }).success).toBe(true);
  });
});

describe("privacy request queue contracts", () => {
  it("defaults to the first page of every request and parses overdue strictly so 'false' stays false", () => {
    expect(listPrivacyRequestsQuerySchema.parse({})).toEqual({
      status: "all", requestType: "all", subjectType: "all", page: 0, limit: 25,
    });
    expect(listPrivacyRequestsQuerySchema.parse({ overdue: "false", page: "2", limit: "10" })).toMatchObject({
      overdue: false, page: 2, limit: 10,
    });
    expect(listPrivacyRequestsQuerySchema.parse({ overdue: "true", status: "open", assignedTo: "unassigned" })).toMatchObject({
      overdue: true, status: "open", assignedTo: "unassigned",
    });
  });

  it("rejects unknown filters, out-of-range paging, and unsupported filter values", () => {
    expect(listPrivacyRequestsQuerySchema.safeParse({ overdue: "yes" }).success).toBe(false);
    expect(listPrivacyRequestsQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(listPrivacyRequestsQuerySchema.safeParse({ page: "-1" }).success).toBe(false);
    expect(listPrivacyRequestsQuerySchema.safeParse({ status: "archived" }).success).toBe(false);
    expect(listPrivacyRequestsQuerySchema.safeParse({ actorRole: "pmcm-admin" }).success).toBe(false);
  });

  it("assigns an operator id or explicitly clears the assignment, and nothing else", () => {
    expect(assignPrivacyRequestSchema.parse({ assignedTo: " usr_maxine " })).toEqual({ assignedTo: "usr_maxine" });
    expect(assignPrivacyRequestSchema.parse({ assignedTo: null })).toEqual({ assignedTo: null });
    expect(assignPrivacyRequestSchema.safeParse({}).success).toBe(false);
    expect(assignPrivacyRequestSchema.safeParse({ assignedTo: "" }).success).toBe(false);
    expect(assignPrivacyRequestSchema.safeParse({ assignedTo: "usr_1", status: "executed" }).success).toBe(false);
  });
});
