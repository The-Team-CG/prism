import { describe, expect, it } from "vitest";
import type { PrismFileRequirementItem, PrismSupplierCertification, PrismSupplierContractVersion } from "@prism/types";
import type { PrismSupplierReadinessItem } from "@prism/types";
import { buildSupplierFileEvents, buildSupplierFileLibrary, buildSupplierNeededFiles, countSupplierFiles, filterSupplierFiles } from "./supplier-file-library";
import type { SupplierFileRequirementRow } from "./supplier-workspace-rules";

const eventNames = new Map([["evt_gala", "Founders Gala"]]);

function row(item: Partial<PrismFileRequirementItem>): SupplierFileRequirementRow {
  return {
    eventId: "evt_gala",
    requestIds: ["req_1"],
    item: { key: "insurance", label: "Insurance certificate", ownerRole: "supplier", origin: "custom", status: "missing", overdue: false, ...item } as PrismFileRequirementItem,
  };
}

const insuranceSentBack = row({
  status: "missing", validationStatus: "rejected", reviewReason: "Policy has expired", uploadedObjectId: "obj_2", dueDate: "2026-11-20T00:00:00.000Z", overdue: true,
  versions: [
    { documentId: "doc_2", objectId: "obj_2", fileName: "insurance-2025.pdf", uploadedAt: "2026-11-05T00:00:00.000Z", status: "rejected", reviewReason: "Policy has expired" },
    { documentId: "doc_1", objectId: "obj_1", fileName: "insurance-draft.pdf", uploadedAt: "2026-11-02T00:00:00.000Z", status: "replaced" },
  ],
});
const permitApproved = row({
  key: "work_permit", label: "Work permit", status: "approved",
  versions: [{ documentId: "doc_3", objectId: "obj_3", fileName: "permit.pdf", uploadedAt: "2026-11-04T00:00:00.000Z", status: "approved", expiresAt: "2026-11-30T00:00:00.000Z" }],
});
const contractMissing = row({ key: "supplier-contract:req_1", label: "Contract", origin: "workflow" as never, status: "missing" });

const contract = {
  id: "ctr_1", eventId: "evt_gala", requestId: "req_1", version: 2, storedObjectId: "obj_ctr", fileName: "contract-v2.pdf", mimeType: "application/pdf",
  reviewStatus: "changes_requested", reviewReason: "Add the overtime rate", uploadedAt: "2026-11-06T00:00:00.000Z",
} as PrismSupplierContractVersion;

const certifications: PrismSupplierCertification[] = [
  { id: "cert_1", fileName: "electrical.pdf", documentType: "Electrical license", issuer: "PRC", expiresAt: "2026-11-01T00:00:00.000Z", uploadedAt: "2026-01-01T00:00:00.000Z" },
  { id: "cert_2", fileName: "fire-safety.pdf", expiresAt: "2026-11-25T00:00:00.000Z", uploadedAt: "2026-02-01T00:00:00.000Z" },
];

describe("supplier file library", () => {
  it("asks for missing and sent-back files first, overdue first, and sends contracts to their booking", () => {
    const needed = buildSupplierNeededFiles([permitApproved, contractMissing, insuranceSentBack], eventNames);

    expect(needed.map((item) => [item.label, item.eventName, item.overdue, item.reviewReason, item.bookingRequestId, item.replacing])).toEqual([
      ["Insurance certificate", "Founders Gala", true, "Policy has expired", undefined, true],
      ["Signed contract", "Founders Gala", false, undefined, "req_1", false],
    ]);
  });

  it("keeps every file the supplier sent, contracts and certifications in one list, newest first", () => {
    const files = buildSupplierFileLibrary({
      rows: [insuranceSentBack, permitApproved, contractMissing], contracts: [contract], certifications, eventNames, now: new Date("2026-11-14T00:00:00.000Z"),
    });

    expect(files.map((file) => [file.name, file.context, file.status, file.objectId])).toEqual([
      ["contract-v2.pdf", "Founders Gala · Contract version 2", "Changes requested", "obj_ctr"],
      ["insurance-2025.pdf", "Founders Gala · Insurance certificate", "Sent back", "obj_2"],
      ["permit.pdf", "Founders Gala · Work permit", "Approved", "obj_3"],
      ["insurance-draft.pdf", "Founders Gala · Insurance certificate", "Replaced", "obj_1"],
      ["fire-safety.pdf", "Certification", "Expires 2026-11-25", undefined],
      ["electrical.pdf", "Electrical license · PRC", "Expired", undefined],
    ]);
    // A certification close to expiry is flagged; an expired one is urgent.
    expect(files.find((file) => file.id === "cert_2")?.tone).toBe("attention");
    expect(files.find((file) => file.id === "cert_1")?.tone).toBe("urgent");
    expect(countSupplierFiles(files)).toEqual({ all: 6, booking: 3, contract: 1, certification: 2 });
    expect(filterSupplierFiles(files, "all", "permit").map((file) => file.name)).toEqual(["permit.pdf"]);
    // A booking document carries the date its file is valid until, and the supplier who sent it may change it.
    expect(files.find((file) => file.name === "permit.pdf")).toMatchObject({ expiresAt: "2026-11-30T00:00:00.000Z", datable: true });
    expect(files.find((file) => file.id === "ctr_1")?.datable).toBeUndefined();
    // The supplier can send a newer file for a requirement PMCM has not approved, from its current file only.
    expect(files.filter((file) => file.replaces).map((file) => [file.name, file.replaces?.key])).toEqual([["insurance-2025.pdf", "insurance"]]);
  });

  it("lists each booked event once with how many asked-for files are in, upcoming first, and keeps files to their event", () => {
    const booking = (patch: Partial<PrismSupplierReadinessItem>) => ({ eventId: "evt_gala", eventName: "Founders Gala", eventDate: "2026-11-30", category: "Catering", quoteStatus: "selected", ...patch }) as PrismSupplierReadinessItem;
    const pmcmOwned = row({ key: "venue_permit", origin: "derived" as never, ownerRole: "pmcm-admin" as never });
    const events = buildSupplierFileEvents(
      [insuranceSentBack, permitApproved, contractMissing, pmcmOwned],
      [
        booking({}),
        booking({ requestId: "req_2", category: "Lights" }),
        booking({ eventId: "evt_launch", eventName: "Store Launch", eventDate: "2026-10-01" }),
        booking({ eventId: "evt_bid", quoteStatus: "submitted" }),
      ],
      "2026-11-16",
    );

    expect(events.map((event) => [event.eventName, event.categories, event.past])).toEqual([["Founders Gala", "Catering, Lights", false], ["Store Launch", "Catering", true]]);
    expect(events[0].tally).toEqual({ total: 3, open: 2, overdue: 1 });
    expect(events[1].tally).toEqual({ total: 0, open: 0, overdue: 0 });

    const files = buildSupplierFileLibrary({ rows: [permitApproved], contracts: [contract], certifications, eventNames });
    expect(files.map((file) => [file.group, file.eventId])).toEqual([["contract", "evt_gala"], ["booking", "evt_gala"], ["certification", undefined], ["certification", undefined]]);
  });
});
