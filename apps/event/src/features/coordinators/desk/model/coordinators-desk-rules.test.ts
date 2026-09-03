import { describe, expect, it } from "vitest";
import {
  isRegistrationCoordinatorRole,
  pickActiveAssignment,
  sameCoordinatorName,
  shouldPreserveRoleViewOnAcknowledgeFailure,
  suggestAvailableSameRoleCoordinators,
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

  it("keeps the role-safe desk when acknowledge refresh fails", () => {
    expect(shouldPreserveRoleViewOnAcknowledgeFailure()).toBe(true);
  });

  it("picks non-replaced assignment first", () => {
    const active = pickActiveAssignment([
      { status: "replaced" },
      { attendanceStatus: "present" },
    ]);
    expect(active?.attendanceStatus).toBe("present");
  });

  it("suggests same-role coordinators who are free on the event date", () => {
    const suggestions = suggestAvailableSameRoleCoordinators({
      coordinators: [
        { id: "coord_busy", name: "Marco", active: true, roleTags: ["Floor Director"] },
        { id: "coord_free", name: "Taylor", active: true, roleTags: ["Floor Director"] },
      ],
      assignments: [
        {
          coordinatorId: "coord_busy",
          eventId: "evt_other",
          eventDate: "2026-06-18",
          status: "acknowledged",
        },
      ],
      eventId: "evt_main",
      eventDate: "2026-06-18",
      role: "Floor Director",
      excludeCoordinatorId: "coord_busy",
    });
    expect(suggestions).toEqual([{ id: "coord_free", name: "Taylor" }]);
  });
});
