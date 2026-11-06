import { describe, expect, it } from "vitest";
import { assignedSupplierRequests, categoriesWithSupplierGap, supplierGapHardBlockCopy, supplierReadinessRefreshKey } from "./pmcm-supplier-readiness-rules";

describe("pmcm-supplier-readiness-rules", () => {
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
