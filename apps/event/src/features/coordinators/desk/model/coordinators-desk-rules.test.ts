import { describe, expect, it } from "vitest";
import {
  buildCoordinatorIssueInput,
  buildCoordinatorTaskInput,
  isTaskOutsideOwnQueue,
  taskAssignedRoleOptions,
  isRegistrationCoordinatorRole,
  pickActiveAssignment,
  sameCoordinatorName,
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
});

/* ── EP-11-S02: coordinator task and issue logging ──────────────── */

const roleView = {
  role: "Floor Director",
  assignment: { coordinatorName: "Marco Santos" },
};

// Deliberately different from assignment.coordinatorName. Finding 8: the
// backend filter compares task.ownerName against the assignment name, so
// sending the session name would silently drop the task from the queue.
const session = { name: "marco.santos", email: "marco@pmcm.test", role: "coordinator" };

describe("buildCoordinatorTaskInput", () => {
  const base = { title: "Stage cue check", assignedRole: "Floor Director" };

  it("omits ownerName when assign-to-me is off", () => {
    const input = buildCoordinatorTaskInput({ ...base, assignToMe: false, roleView });
    expect("ownerName" in input).toBe(false);
  });

  it("sets ownerName from the assignment when assign-to-me is on", () => {
    const input = buildCoordinatorTaskInput({ ...base, assignToMe: true, roleView });
    expect(input.ownerName).toBe("Marco Santos");
    expect(input.ownerName).not.toBe(session.name);
  });

  it("omits blank optional fields rather than sending empty strings", () => {
    const input = buildCoordinatorTaskInput({
      ...base, priority: "", notes: "   ", dueAt: "", assignToMe: false, roleView,
    });
    expect("priority" in input).toBe(false);
    expect("notes" in input).toBe(false);
    expect("dueAt" in input).toBe(false);
  });

  it("converts dueAt to ISO and drops an unparseable value", () => {
    const ok = buildCoordinatorTaskInput({
      ...base, dueAt: "2026-09-02T10:00", assignToMe: false, roleView,
    });
    expect(ok.dueAt).toBe(new Date("2026-09-02T10:00").toISOString());

    const bad = buildCoordinatorTaskInput({
      ...base, dueAt: "not-a-date", assignToMe: false, roleView,
    });
    expect("dueAt" in bad).toBe(false);
  });
});

describe("buildCoordinatorIssueInput", () => {
  const base = { title: "Walk-in queue overflow", severity: "high" as const };

  it("omits ownerName and ownerRole when assign-to-me is off", () => {
    const input = buildCoordinatorIssueInput({ ...base, assignToMe: false, roleView });
    expect("ownerName" in input).toBe(false);
    expect("ownerRole" in input).toBe(false);
  });

  it("sets ownerName and ownerRole when assign-to-me is on", () => {
    const input = buildCoordinatorIssueInput({ ...base, assignToMe: true, roleView });
    expect(input.ownerName).toBe("Marco Santos");
    expect(input.ownerName).not.toBe(session.name);
    expect(input.ownerRole).toBe("Floor Director");
  });

  it("passes affectedArea through when non-empty and omits it when blank", () => {
    const withArea = buildCoordinatorIssueInput({
      ...base, affectedArea: "Main Hall", assignToMe: false, roleView,
    });
    expect(withArea.affectedArea).toBe("Main Hall");

    const blank = buildCoordinatorIssueInput({
      ...base, affectedArea: "   ", assignToMe: false, roleView,
    });
    expect("affectedArea" in blank).toBe(false);
  });
});

describe("isTaskOutsideOwnQueue", () => {
  it("is true only when the task routes away from this coordinator", () => {
    expect(isTaskOutsideOwnQueue({
      assignedRole: "Usher", ownRole: "Floor Director", assignToMe: false,
    })).toBe(true);
  });

  it("is false for the coordinator's own role, General Coordinator, or assign-to-me", () => {
    expect(isTaskOutsideOwnQueue({
      assignedRole: "Floor Director", ownRole: "Floor Director", assignToMe: false,
    })).toBe(false);
    // Literal special-cased by the backend at live-ops-read-models.service.ts:72.
    expect(isTaskOutsideOwnQueue({
      assignedRole: "General Coordinator", ownRole: "Floor Director", assignToMe: false,
    })).toBe(false);
    // Assign-to-me admits it via the ownerName clause instead.
    expect(isTaskOutsideOwnQueue({
      assignedRole: "Usher", ownRole: "Floor Director", assignToMe: true,
    })).toBe(false);
  });
});

describe("taskAssignedRoleOptions", () => {
  it("returns the seven provisional roles without duplicating a listed role", () => {
    const options = taskAssignedRoleOptions(roleView);
    expect(options).toEqual([
      "General Coordinator",
      "Event Day System Operator",
      "Registration Staff",
      "Floor Director",
      "Stage Director",
      "Ingress and Egress Assistant",
      "Usher",
    ]);
  });

  it("prepends a non-listed role exactly once", () => {
    const options = taskAssignedRoleOptions({ ...roleView, role: "Drone Marshal" });
    expect(options[0]).toBe("Drone Marshal");
    expect(options.filter((r) => r === "Drone Marshal")).toHaveLength(1);
    expect(options).toHaveLength(8);
  });
});
