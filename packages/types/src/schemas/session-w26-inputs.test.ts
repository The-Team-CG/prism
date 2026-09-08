import { describe, expect, it } from "vitest";
import { decideFreezeExceptionSchema, issueAddendumSchema } from "./session-w26-inputs.js";

describe("W26 write contracts", () => {
  it("rejects a rejected exception without an explanation", () => {
    expect(decideFreezeExceptionSchema.safeParse({ decision: "reject" }).success).toBe(false);
  });

  it("requires a scanned-document reference for an issued addendum", () => {
    expect(issueAddendumSchema.safeParse({ title: "Updated scope", contractSnapshot: [], quoteSnapshot: [] }).success).toBe(false);
    expect(issueAddendumSchema.safeParse({ title: "Updated scope", documentId: "doc_scan_1", contractSnapshot: [], quoteSnapshot: [] }).success).toBe(true);
  });
});
