import { describe, expect, it } from "vitest";
import {
  isRegistrationCoordinatorRole,
  pickActiveAssignment,
  sameCoordinatorName,
  shouldPreserveRoleViewOnAcknowledgeFailure,
} from "./coordinators-desk-rules";

describe("coordinators-desk-rules", () => {
  it("compares coordinator names case-insensitively", () => {
    expect(sameCoordinatorName("Marco", "marco")).toBe(true);
    expect(sameCoordinatorName("A", "B")).toBe(false);
  });

  it("detects registration roles", () => {
    expect(isRegistrationCoordinatorRole("Registration Lead")).toBe(true);
    expect(isRegistrationCoordinatorRole("Floor Manager")).toBe(false);
  });

  it("picks non-replaced assignment first", () => {
    const active = pickActiveAssignment([
      { status: "replaced" },
      { attendanceStatus: "present" },
    ]);
    expect(active?.attendanceStatus).toBe("present");
  });

  it("keeps the loaded role view when acknowledge refresh fails", () => {
    expect(shouldPreserveRoleViewOnAcknowledgeFailure()).toBe(true);
  });
});
