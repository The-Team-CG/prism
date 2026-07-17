import { describe, expect, it } from "vitest";
import {
  asIsoDateTime,
  computeLiveOpsMetrics,
  liveOpsPillClass,
} from "./live-ops-workspace-rules";

describe("live-ops-workspace-rules", () => {
  it("maps status pill classes", () => {
    expect(liveOpsPillClass("done")).toContain("emerald");
    expect(liveOpsPillClass("critical")).toContain("rose");
    expect(liveOpsPillClass("in_progress")).toContain("amber");
  });

  it("parses iso datetimes", () => {
    expect(asIsoDateTime("")).toBeUndefined();
    expect(asIsoDateTime("not-a-date")).toBeUndefined();
    expect(asIsoDateTime("2026-07-17T10:00:00.000Z")).toBe("2026-07-17T10:00:00.000Z");
  });

  it("computes live-ops metrics", () => {
    const m = computeLiveOpsMetrics({
      tasks: [{ status: "done" }, { status: "open" }],
      urgentIssues: [{ status: "open" }, { status: "resolved" }],
      supplierStatuses: [{ verificationStatus: "verified" }],
      coordinatorAssignments: [{ attendanceStatus: "present" }],
    });
    expect(m).toEqual({
      completedTasks: 1,
      openIssues: 1,
      verifiedSuppliers: 1,
      presentCoordinators: 1,
    });
  });
});
