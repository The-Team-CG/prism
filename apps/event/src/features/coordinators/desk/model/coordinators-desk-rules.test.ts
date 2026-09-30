import { describe, expect, it } from "vitest";
import { parseContract, updateCoordinatorAttendanceSchema } from "@prism/types";
import {
  buildCoordinatorAttendanceInput,
  buildCoordinatorIssueInput,
  buildCoordinatorTaskInput,
  availabilityRangeFromDates,
  canCoordinatorUpdateTask,
  canConfirmPendingAttendance,
  canMarkOwnAttendance,
  confirmedSupplierChecks,
  delegatedAttendanceTargets,
  describeReminderResult,
  formatAvailabilityRange,
  isAttendanceChoiceDisabled,
  isIngressOrEgressRole,
  isOperatorEligibleAssignment,
  isReplacedAssignment,
  isTaskOutsideOwnQueue,
  requiresAttendanceConfirmation,
  resolveOwnAttendanceStatus,
  attendanceChoiceLabel,
  taskAssignedRoleOptions,
  isRegistrationCoordinatorRole,
  isCoordinatorAssignmentActive,
  pickActiveAssignment,
  sameCoordinatorName,
  shouldPreserveRoleViewOnAcknowledgeFailure,
  suggestAvailableSameRoleCoordinators,
  COORDINATOR_ATTENDANCE_CHOICES,
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

  it("does not count cancelled or replaced assignments as active", () => {
    expect(isCoordinatorAssignmentActive({ status: "acknowledged" })).toBe(true);
    expect(isCoordinatorAssignmentActive({ status: "cancelled" })).toBe(false);
    expect(isCoordinatorAssignmentActive({ status: "replaced" })).toBe(false);
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

/* ── EP-11-S03: coordinator self-attendance marking ──────────────── */

describe("COORDINATOR_ATTENDANCE_CHOICES", () => {
  it("offers exactly present, late and absent, in that order", () => {
    expect(COORDINATOR_ATTENDANCE_CHOICES.map((choice) => choice.value)).toEqual([
      "present",
      "late",
      "absent",
    ]);
  });

  it("never offers pending or replaced", () => {
    // pending is a schema default nobody chooses; replaced is written by the
    // PMCM replacement flow (live-operations.service.ts:505-517).
    const values: string[] = COORDINATOR_ATTENDANCE_CHOICES.map((choice) => choice.value);
    expect(values).not.toContain("pending");
    expect(values).not.toContain("replaced");
  });

  it("labels late as Late Arrival", () => {
    expect(COORDINATOR_ATTENDANCE_CHOICES.find((choice) => choice.value === "late")?.label).toBe(
      "Late Arrival",
    );
  });
});

describe("resolveOwnAttendanceStatus", () => {
  it("reads the attendance vocabulary, falling back to pending", () => {
    expect(resolveOwnAttendanceStatus({ attendanceStatus: "late" })).toBe("late");
    expect(resolveOwnAttendanceStatus({})).toBe("pending");
    expect(resolveOwnAttendanceStatus(undefined)).toBe("pending");
    expect(resolveOwnAttendanceStatus(null)).toBe("pending");
  });

  it("PA-299: never falls back to the acknowledgment vocabulary", () => {
    // status carries pending_acknowledgement / acknowledged. Neither is an
    // attendance value, and neither may reach a control comparing against
    // present / late / absent.
    expect(
      resolveOwnAttendanceStatus({ status: "pending_acknowledgement" } as { attendanceStatus?: string }),
    ).toBe("pending");
    expect(
      resolveOwnAttendanceStatus({ status: "acknowledged" } as { attendanceStatus?: string }),
    ).toBe("pending");
  });
});

describe("attendanceChoiceLabel", () => {
  it("labels an offered choice and returns null for none", () => {
    expect(attendanceChoiceLabel("absent")).toBe("Absent");
    expect(attendanceChoiceLabel("late")).toBe("Late Arrival");
    expect(attendanceChoiceLabel(null)).toBeNull();
  });
});

describe("isReplacedAssignment", () => {
  it("is true when either vocabulary marks the row replaced", () => {
    // replaceCoordinatorAssignment writes status AND attendanceStatus in one
    // transaction, so both are populated in practice.
    expect(isReplacedAssignment({ attendanceStatus: "replaced", status: "replaced" })).toBe(true);
    expect(isReplacedAssignment({ status: "replaced" })).toBe(true);
    expect(isReplacedAssignment({ attendanceStatus: "replaced" })).toBe(true);
  });

  it("is false for a live assignment and for no assignment", () => {
    expect(isReplacedAssignment({ attendanceStatus: "present", status: "acknowledged" })).toBe(false);
    expect(isReplacedAssignment(undefined)).toBe(false);
    expect(isReplacedAssignment(null)).toBe(false);
  });
});

describe("canMarkOwnAttendance", () => {
  const live = { attendanceStatus: "pending", status: "acknowledged" };

  it("allows marking on a live assignment", () => {
    expect(canMarkOwnAttendance({ assignment: live, busy: false })).toBe(true);
  });

  it("blocks with no assignment, a replaced assignment, or while busy", () => {
    expect(canMarkOwnAttendance({ assignment: undefined, busy: false })).toBe(false);
    expect(canMarkOwnAttendance({ assignment: { status: "replaced" }, busy: false })).toBe(false);
    expect(canMarkOwnAttendance({ assignment: live, busy: true })).toBe(false);
  });

  it("blocks while the attendance flow itself is in flight", () => {
    // Both in-flight flags are folded in here rather than OR-ed at the call
    // site, so the rule is tested rather than living in the view-model.
    expect(canMarkOwnAttendance({ assignment: live, busy: false, attendanceBusy: true })).toBe(false);
    expect(canMarkOwnAttendance({ assignment: live, busy: false, attendanceBusy: false })).toBe(true);
  });

  it("does NOT lock out a coordinator who already marked absent", () => {
    // The reliability note is irreversible; attendanceStatus is not — the
    // update overwrites it. A permanent lockout is not in AC1.
    expect(
      canMarkOwnAttendance({ assignment: { ...live, attendanceStatus: "absent" }, busy: false }),
    ).toBe(true);
  });
});

describe("isAttendanceChoiceDisabled", () => {
  it("disables only the status already set", () => {
    expect(
      isAttendanceChoiceDisabled({ choice: "present", attendanceStatus: "present", canMark: true }),
    ).toBe(true);
    expect(
      isAttendanceChoiceDisabled({ choice: "late", attendanceStatus: "present", canMark: true }),
    ).toBe(false);
  });

  it("leaves the other two enabled when the current status is absent", () => {
    expect(
      isAttendanceChoiceDisabled({ choice: "present", attendanceStatus: "absent", canMark: true }),
    ).toBe(false);
    expect(
      isAttendanceChoiceDisabled({ choice: "late", attendanceStatus: "absent", canMark: true }),
    ).toBe(false);
    expect(
      isAttendanceChoiceDisabled({ choice: "absent", attendanceStatus: "absent", canMark: true }),
    ).toBe(true);
  });

  it("disables every choice when marking is not allowed", () => {
    for (const choice of COORDINATOR_ATTENDANCE_CHOICES) {
      expect(
        isAttendanceChoiceDisabled({
          choice: choice.value,
          attendanceStatus: "pending",
          canMark: false,
        }),
      ).toBe(true);
    }
  });
});

describe("canConfirmPendingAttendance", () => {
  const live = { attendanceStatus: "pending", status: "acknowledged" };

  it("allows confirming a pending choice on a live assignment", () => {
    expect(
      canConfirmPendingAttendance({ assignment: live, pendingChoice: "absent", busy: false }),
    ).toBe(true);
  });

  it("refuses once the assignment became replaced while the prompt was open", () => {
    // The defect: the confirm prompt stays rendered after a PMCM replacement,
    // the coordinator taps confirm, and a request fires against an assignment
    // the server will reject. Rejecting at submit time is the guarantee;
    // hiding the prompt is only a render concern and can lose the race.
    expect(
      canConfirmPendingAttendance({
        assignment: { attendanceStatus: "replaced", status: "replaced" },
        pendingChoice: "absent",
        busy: false,
      }),
    ).toBe(false);
  });

  it("refuses once the assignment disappeared entirely", () => {
    expect(
      canConfirmPendingAttendance({ assignment: undefined, pendingChoice: "absent", busy: false }),
    ).toBe(false);
    expect(
      canConfirmPendingAttendance({ assignment: null, pendingChoice: "absent", busy: false }),
    ).toBe(false);
  });

  it("refuses when nothing is pending, or while a mark is already in flight", () => {
    expect(
      canConfirmPendingAttendance({ assignment: live, pendingChoice: null, busy: false }),
    ).toBe(false);
    expect(
      canConfirmPendingAttendance({ assignment: live, pendingChoice: "absent", busy: true }),
    ).toBe(false);
  });

  it("does NOT treat an absent attendanceStatus as a missing assignment", () => {
    // Guards the lockout regression: 'absent' is a status a coordinator can
    // already hold and correct from. Only a replaced or missing assignment
    // blocks confirming.
    expect(
      canConfirmPendingAttendance({
        assignment: { ...live, attendanceStatus: "absent" },
        pendingChoice: "present",
        busy: false,
      }),
    ).toBe(true);
  });
});

describe("requiresAttendanceConfirmation", () => {
  it("confirms absent only", () => {
    // Absent writes a severity 'critical' reliability note with no retraction
    // path (live-operations.service.ts:627). Late writes 'warning', and is the
    // status a coordinator taps while already behind schedule.
    expect(requiresAttendanceConfirmation("absent")).toBe(true);
    expect(requiresAttendanceConfirmation("late")).toBe(false);
    expect(requiresAttendanceConfirmation("present")).toBe(false);
  });
});

describe("buildCoordinatorAttendanceInput", () => {
  it("sends the chosen status with empty notes", () => {
    // notes flows verbatim into permanent reliability-note text
    // (live-operations.service.ts:626). Whether a coordinator may write their
    // own reason is a pending product decision, so nothing is sent.
    expect(buildCoordinatorAttendanceInput("late")).toEqual({ status: "late", notes: "" });
  });

  it("passes parseContract for every offered choice", () => {
    // The schema types status as nonEmptyStringSchema, not an enum, so it will
    // NOT reject an invalid status. COORDINATOR_ATTENDANCE_CHOICES is the only
    // constraint; this asserts every value it offers is at least accepted.
    for (const choice of COORDINATOR_ATTENDANCE_CHOICES) {
      expect(() =>
        parseContract(
          updateCoordinatorAttendanceSchema,
          buildCoordinatorAttendanceInput(choice.value),
          "Update coordinator attendance",
        ),
      ).not.toThrow();
    }
  });
});

describe("canCoordinatorUpdateTask", () => {
  const floorDirector = { role: "Floor Director", assignment: { coordinatorName: "Marco Santos" } };

  it("lets a coordinator progress tasks in their own queue, unowned or owned by them", () => {
    expect(canCoordinatorUpdateTask({ assignedRole: "Floor Director", ownerName: "" }, floorDirector)).toBe(true);
    expect(canCoordinatorUpdateTask({ assignedRole: "floor director", ownerName: "marco santos" }, floorDirector)).toBe(true);
  });

  it("hides the action on tasks the API would refuse: another owner, another role, or General Coordinator", () => {
    expect(canCoordinatorUpdateTask({ assignedRole: "Floor Director", ownerName: "Taylor Reyes" }, floorDirector)).toBe(false);
    expect(canCoordinatorUpdateTask({ assignedRole: "Stage Director", ownerName: "Marco Santos" }, floorDirector)).toBe(false);
    expect(canCoordinatorUpdateTask({ assignedRole: "General Coordinator", ownerName: "" }, floorDirector)).toBe(false);
  });

  it("lets the designated operator progress any task", () => {
    expect(canCoordinatorUpdateTask({ assignedRole: "Stage Director", ownerName: "Taylor Reyes" }, { ...floorDirector, isDesignatedOperator: true })).toBe(true);
  });
});

describe("operator and supplier check eligibility", () => {
  it("treats ingress and egress roles alike", () => {
    expect(isIngressOrEgressRole("Ingress and Egress Assistant")).toBe(true);
    expect(isIngressOrEgressRole("Egress Lead")).toBe(true);
    expect(isIngressOrEgressRole("Floor Director")).toBe(false);
    expect(isIngressOrEgressRole(undefined)).toBe(false);
  });

  it("only offers coordinators who are working the event as operator", () => {
    expect(isOperatorEligibleAssignment({ coordinatorId: "coord_1", status: "acknowledged" })).toBe(true);
    expect(isOperatorEligibleAssignment({ coordinatorId: "coord_1", status: "pending_acknowledgement" })).toBe(true);
    for (const status of ["cancelled", "replaced", "declined"]) {
      expect(isOperatorEligibleAssignment({ coordinatorId: "coord_1", status })).toBe(false);
    }
    expect(isOperatorEligibleAssignment({ coordinatorId: null, status: "acknowledged" })).toBe(false);
  });

  it("marks attendance only for other coordinators who are still on the event", () => {
    const targets = delegatedAttendanceTargets([
      { id: "own", status: "acknowledged" },
      { id: "active", status: "acknowledged" },
      { id: "replaced", status: "replaced" },
      { id: "released", status: "cancelled" },
    ], "own");
    expect(targets.map((item) => item.id)).toEqual(["active"]);
  });

  it("checks only suppliers with a confirmed assignment", () => {
    const suppliers = [
      { id: "confirmed", assignmentStatus: "confirmed" },
      { id: "pending", assignmentStatus: "pending_confirmation" },
      { id: "withdrawn", assignmentStatus: "withdrawn" },
    ];
    expect(confirmedSupplierChecks(suppliers).map((item) => item.id)).toEqual(["confirmed"]);
  });
});

describe("coordinator unavailable dates", () => {
  // The API's overlap test for an event day (coordinators.service.ts resolveAssignmentPlan).
  const blocksEventDay = (range: { startsAt: string; endsAt: string }, eventDay: string) => {
    const dayStart = Date.parse(`${eventDay}T00:00:00.000Z`);
    return Date.parse(range.startsAt) < dayStart + 86_400_000 && Date.parse(range.endsAt) > dayStart;
  };

  it("blocks exactly the chosen days, never a neighbouring day", () => {
    const range = availabilityRangeFromDates("2026-12-10", "2026-12-11");
    expect(range).toEqual({ startsAt: "2026-12-10T00:00:00.000Z", endsAt: "2026-12-12T00:00:00.000Z" });
    expect(blocksEventDay(range, "2026-12-09")).toBe(false);
    expect(blocksEventDay(range, "2026-12-10")).toBe(true);
    expect(blocksEventDay(range, "2026-12-11")).toBe(true);
    expect(blocksEventDay(range, "2026-12-12")).toBe(false);
  });

  it("rejects a missing day or a range that ends before it starts", () => {
    expect(() => availabilityRangeFromDates("", "2026-12-10")).toThrow("Choose the first and last unavailable day.");
    expect(() => availabilityRangeFromDates("2026-12-11", "2026-12-10")).toThrow("cannot be before");
  });

  it("shows a single day once and a longer block as first to last day", () => {
    expect(formatAvailabilityRange(availabilityRangeFromDates("2026-12-10", "2026-12-10"))).toBe("2026-12-10");
    expect(formatAvailabilityRange(availabilityRangeFromDates("2026-12-10", "2026-12-12"))).toBe("2026-12-10 to 2026-12-12");
  });
});

describe("describeReminderResult", () => {
  it("says when nothing was due and when the request failed", () => {
    expect(describeReminderResult(null)).toMatch(/not sent/i);
    expect(describeReminderResult({ leadTimeDays: 7, reminders: [] })).toMatch(/within 7 days.*no reminders were sent/i);
  });

  it("counts reminded coordinators and calls out failures", () => {
    const queued = { assignmentId: "a1", status: "queued", reason: null };
    expect(describeReminderResult({ leadTimeDays: 7, reminders: [queued] })).toBe("1 pending coordinator reminded.");
    expect(describeReminderResult({ leadTimeDays: 7, reminders: [queued, { ...queued, assignmentId: "a2" }] })).toBe("2 pending coordinators reminded.");
    expect(describeReminderResult({ leadTimeDays: 7, reminders: [queued, { assignmentId: "a2", status: "failed", reason: "no email" }] }))
      .toBe("1 pending coordinator reminded. 1 could not be sent; check the PMCM status message.");
  });
});
