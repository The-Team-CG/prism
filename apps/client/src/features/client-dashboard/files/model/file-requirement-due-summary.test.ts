import { describe, expect, it } from "vitest";
import { fileRequirementDueSummary } from "./file-requirement-due-summary";

describe("fileRequirementDueSummary", () => {
  it("shows required state, due date and overdue flag for the client", () => {
    expect(fileRequirementDueSummary({ required: true, dueDate: "2026-10-25T12:00:00.000Z", overdue: true })).toMatch(/^Required · Due (25 Oct|Oct 25,) 2026 · Overdue$/);
  });

  it("omits the due date and overdue flag for optional items without a date", () => {
    expect(fileRequirementDueSummary({ required: false, overdue: false })).toBe("Optional");
  });
});
