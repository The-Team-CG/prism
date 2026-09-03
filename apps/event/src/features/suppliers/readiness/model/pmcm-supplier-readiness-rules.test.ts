import { describe, expect, it } from "vitest";
import { isLockedQuoteStatus, pmcmSupplierReadinessRows, categoriesWithSupplierGap } from "./pmcm-supplier-readiness-rules";

describe("pmcm-supplier-readiness-rules", () => {
  it("treats selected quotes as locked and maps readiness from quote requests", () => {
    expect(isLockedQuoteStatus("selected")).toBe(true);
    const rows = pmcmSupplierReadinessRows(
      [
        {
          id: "qr_1",
          eventId: "evt_1",
          supplierName: "Sonic Line",
          category: "Technicals",
          message: "",
          accessToken: "token",
          confidentialBid: false,
          status: "submitted",
          assignmentStatus: "confirmed",
          readinessStatus: "confirmed",
          createdAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      [
        {
          id: "quote_1",
          requestId: "qr_1",
          supplierName: "Sonic Line",
          category: "Technicals",
          amount: 1000,
          inclusions: [],
          paymentTerms: "",
          notes: "",
          outsideAcceptableRange: false,
          status: "selected",
          createdAt: "2026-09-01T00:00:00.000Z",
        },
      ],
    );
    expect(rows[0]).toMatchObject({
      locked: true,
      readinessStatus: "confirmed",
      quoteStatus: "selected",
    });
  });

  it("hard-blocks categories that still have no selected quote", () => {
    const rows = pmcmSupplierReadinessRows(
      [
        {
          id: "qr_open",
          eventId: "evt_1",
          supplierName: "Open Bid",
          category: "Catering",
          message: "",
          accessToken: "token",
          confidentialBid: false,
          status: "sent",
          assignmentStatus: "unassigned",
          readinessStatus: "not_confirmed",
          createdAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      [],
    );
    expect(categoriesWithSupplierGap(rows)).toEqual(["Catering"]);
  });
});
