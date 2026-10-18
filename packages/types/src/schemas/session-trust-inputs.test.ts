import { describe, expect, it } from "vitest";
import { executePrivacyRequestSchema, privacyCorrectionPatchSchema } from "./session-trust-inputs.js";

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
