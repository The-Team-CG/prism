import { describe, expect, it } from "vitest";
import {
  assignedSupplierRequests,
  categoriesWithSupplierGap,
  orderSupplierSchedule,
  scheduleConflictItemIds,
  scheduleWindowsOverlap,
  supplierGapHardBlockCopy,
  supplierReadinessRefreshKey,
} from "./pmcm-supplier-readiness-rules";

function scheduled(id: string, category: string, ingressAt: string | null, egressAt = "2026-10-02T15:00:00.000Z", quoteStatus = "selected") {
  return {
    id,
    category,
    quoteStatus,
    schedule: ingressAt ? { ingressAt, egressAt } : null,
  };
}

describe("pmcm-supplier-readiness-rules", () => {
  it("flags only selected suppliers whose ingress windows overlap, and treats back-to-back windows as clear", () => {
    const items = [
      scheduled("qr_stage", "Production", "2026-10-02T04:00:00.000Z", "2026-10-02T10:00:00.000Z"),
      scheduled("qr_lights", "Technicals", "2026-10-02T09:59:00.000Z", "2026-10-02T10:00:00.000Z"),
      scheduled("qr_catering", "Catering", "2026-10-02T10:00:00.000Z", "2026-10-02T13:00:00.000Z"),
      scheduled("qr_bid", "Technicals", "2026-10-02T04:00:00.000Z", "2026-10-02T10:00:00.000Z", "open"),
    ];

    expect([...scheduleConflictItemIds(items)].sort()).toEqual(["qr_lights", "qr_stage"]);
    expect(scheduleWindowsOverlap(
      { ingressAt: "2026-10-02T04:00:00.000Z", egressAt: "2026-10-02T10:00:00.000Z" },
      { ingressAt: "2026-10-02T10:00:00.000Z", egressAt: "2026-10-02T13:00:00.000Z" },
    )).toBe(false);
  });

  it("orders the schedule production-first, then by ingress start, with unscheduled suppliers last", () => {
    const ordered = orderSupplierSchedule([
      scheduled("qr_lights", "Technicals", "2026-10-02T06:00:00.000Z"),
      scheduled("qr_unbooked", "Production", null),
      scheduled("qr_stage_late", "Production", "2026-10-02T08:00:00.000Z"),
      scheduled("qr_stage_early", "Production", "2026-10-02T05:00:00.000Z"),
      scheduled("qr_catering", "Catering", "2026-10-02T04:00:00.000Z"),
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["qr_stage_early", "qr_stage_late", "qr_unbooked", "qr_catering", "qr_lights"]);
  });

  it("counts assigned suppliers as selected requests, the same rows the Bookings tab lists", () => {
    const requests = [
      { id: "qr_harvest", status: "selected" },
      { id: "qr_lens", status: "selected" },
      { id: "qr_sonic", status: "submitted" },
      { id: "qr_pulse", status: "open" },
    ];

    expect(assignedSupplierRequests(requests).map((request) => request.id)).toEqual(["qr_harvest", "qr_lens"]);
  });

  it("hard-blocks only categories where no server item has a locked quote", () => {
    const gaps = categoriesWithSupplierGap([
      { category: "Catering", quoteLocked: false },
      { category: "Technicals", quoteLocked: false },
      { category: "Technicals", quoteLocked: true },
    ]);

    expect(gaps).toEqual(["Catering"]);
    expect(supplierGapHardBlockCopy(gaps)).toBe("Do not advance planning until a supplier is selected in: Catering.");
    expect(supplierGapHardBlockCopy([])).toBeNull();
  });

  it("changes the refresh key when a planner action changes request state, regardless of order", () => {
    const open = { id: "qr_1", status: "open", assignmentStatus: "pending_confirmation", readinessStatus: "not_requested", eventDayStatus: "not_started" };
    const other = { id: "qr_2", status: "submitted" };

    expect(supplierReadinessRefreshKey([open, other])).toBe(supplierReadinessRefreshKey([other, open]));
    expect(supplierReadinessRefreshKey([{ ...open, status: "selected" }, other])).not.toBe(supplierReadinessRefreshKey([open, other]));
  });
});
