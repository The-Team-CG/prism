import { describe, expect, it } from "vitest";
import { eventFileCategoryOf, eventFileLogicalTarget } from "./event-file-categories";

describe("event file categories", () => {
  it("round-trips a category through the logical target and reads older uploads as other", () => {
    expect(eventFileCategoryOf(eventFileLogicalTarget("evt_1", "work_permit", "a1"))).toBe("work_permit");
    expect(eventFileCategoryOf("event-deliverable:evt_1:3f2b-attempt")).toBe("other");
  });
});
