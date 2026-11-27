import { describe, expect, it } from "vitest";
import type { PrismSupplierReadinessItem } from "@prism/types";
import { serviceInclusionList, supplierContactPerson, supplierTrackRecord } from "./supplier-profile";
import type { PrismSupplierQuote, PrismSupplierQuoteRequest } from "./supplier-workspace-types";

describe("supplier profile", () => {
  it.each([
    ["one per line", "Kiosks\n- Printers\n\nOn-site operator", ["Kiosks", "Printers", "On-site operator"]],
    ["semicolons and bullets", "Kiosks; Printers • Operator", ["Kiosks", "Printers", "Operator"]],
    ["a comma list on one line", "Kiosks, printers, operator", ["Kiosks", "printers", "operator"]],
    ["one item with a comma", "Lights, sound", ["Lights, sound"]],
    ["nothing", "  ", []],
  ])("reads inclusions written as %s", (_name, text, items) => {
    expect(serviceInclusionList(text)).toEqual(items);
  });

  it("shows a contact person only when PMCM has a name other than the company's", () => {
    expect(supplierContactPerson({ name: "XPERTO Registration", contactName: "xperto registration " })).toBeNull();
    expect(supplierContactPerson({ name: "XPERTO Registration", contactName: "Rina Santos" })).toBe("Rina Santos");
  });

  it("counts the supplier's own quotes and bookings, and the last and next event", () => {
    const bookings = [{ id: "a" }, { id: "b" }, { id: "c" }] as PrismSupplierQuoteRequest[];
    const readiness = [
      { requestId: "a", eventDate: "2026-10-26" },
      { requestId: "b", eventDate: "2026-11-24" },
      { requestId: "c", eventDate: "2026-12-18" },
    ] as PrismSupplierReadinessItem[];
    const record = supplierTrackRecord({ quotes: [{}, {}, {}, {}] as PrismSupplierQuote[], bookings, readiness, todayKey: "2026-11-20" });
    expect(record).toEqual({ quotesSent: 4, bookings: 3, completed: 1, lastEvent: "2026-10-26", nextEvent: "2026-11-24" });
  });
});
