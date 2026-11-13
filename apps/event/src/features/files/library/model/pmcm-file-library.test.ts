import { describe, expect, it } from "vitest";
import type { PrismFileRequirementItem, PrismStoredObject } from "@prism/types";
import { buildPmcmFileLibrary, countPmcmFiles, filterPmcmFiles, pmcmFileExpiry, pmcmReviewQueue } from "./pmcm-file-library";

function stored(id: string, overrides: Partial<PrismStoredObject> = {}): PrismStoredObject {
  return {
    id, eventId: "evt_1", ownerRecordType: "event", ownerRecordId: "evt_1", logicalTarget: `client-upload:evt_1:${id}`,
    usage: "client_document", originalFileName: `${id}.pdf`, contentType: "application/pdf", declaredByteSize: 2048,
    checksumSha256: "a".repeat(64), uploaderActorId: "usr_client", uploaderActorRole: "client", lifecycleState: "stored",
    providerName: "local", providerObjectKey: id, failureReason: null, requestedAt: "2026-11-01T00:00:00.000Z",
    storedAt: "2026-11-01T00:00:01.000Z", failedAt: null, deletedAt: null, createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:01.000Z",
    ...overrides,
  };
}

const version = (documentId: string, objectId: string, status: string, uploadedAt: string, reviewReason?: string) => ({
  documentId, objectId, fileName: `${objectId}.pdf`, uploadedAt, status, ...(reviewReason ? { reviewReason } : {}),
});

const permit = {
  key: "venue_permit", label: "Venue permit", ownerRole: "client", origin: "custom", status: "submitted",
  versions: [
    version("doc_2", "obj_permit_v2", "submitted", "2026-11-03T00:00:00.000Z"),
    version("doc_1", "obj_permit_v1", "rejected", "2026-11-02T00:00:00.000Z", "Unsigned"),
  ],
} as unknown as PrismFileRequirementItem;

const insurance = {
  key: "insurance", label: "Insurance certificate", ownerRole: "supplier", origin: "custom", status: "submitted",
  supplierFulfilments: [
    { supplierId: "sup_atlas", supplierName: "Atlas Sound", status: "approved", versions: [version("doc_3", "obj_atlas", "approved", "2026-11-01T00:00:00.000Z")] },
    { supplierId: "sup_sonic", supplierName: "Sonic Line", status: "submitted", versions: [version("doc_4", "obj_sonic", "submitted", "2026-11-01T12:00:00.000Z")] },
  ],
} as unknown as PrismFileRequirementItem;

describe("PMCM file library", () => {
  it("lists every stored file with who sent it, what it was for and where its review stands", () => {
    const { files, unfinished } = buildPmcmFileLibrary([
      stored("obj_permit_v2", { storedAt: "2026-11-03T00:00:00.000Z" }),
      stored("obj_permit_v1", { storedAt: "2026-11-02T00:00:00.000Z" }),
      stored("obj_atlas", { uploaderActorRole: "supplier", usage: "supplier_document" }),
      stored("obj_runsheet", { uploaderActorRole: "pmcm-admin", usage: "event_deliverable", logicalTarget: "event-file:evt_1:floor_plan:a1" }),
      stored("obj_failed", { lifecycleState: "failed", failureReason: "Storage provider could not issue an upload location" }),
      stored("obj_gone", { lifecycleState: "deleted" }),
    ], [permit, insurance]);

    expect(files.map((file) => [file.id, file.from, file.label, file.status])).toEqual([
      ["obj_permit_v2", "Client", "Venue permit", "Waiting for review"],
      ["obj_permit_v1", "Client", "Venue permit", "Rejected"],
      ["obj_atlas", "Atlas Sound", "Insurance certificate", "Approved"],
      ["obj_runsheet", "PMCM", "Floor plan", "Shared with client"],
    ]);
    expect(files[1]?.reviewReason).toBe("Unsigned");
    expect(files[0]?.review).toMatchObject({ key: "venue_permit", documentId: "doc_2" });
    // Uploads that never finished are kept out of the library, and deleted ones are gone.
    expect(unfinished.map((upload) => upload.id)).toEqual(["obj_failed"]);
  });

  it("carries each file's expiry and warns a month before it", () => {
    const { files } = buildPmcmFileLibrary([stored("obj_permit_v2", { expiresAt: "2026-11-30T00:00:00.000Z" })], [permit]);
    expect(files[0]?.expiresAt).toBe("2026-11-30T00:00:00.000Z");
    const now = new Date("2026-11-14T00:00:00Z");
    expect(pmcmFileExpiry("2026-11-30T00:00:00.000Z", now)).toEqual({ label: "Expires 2026-11-30", tone: "attention" });
    expect(pmcmFileExpiry("2026-11-01T00:00:00.000Z", now)).toEqual({ label: "Expired 2026-11-01", tone: "urgent" });
    expect(pmcmFileExpiry("2027-06-01T00:00:00.000Z", now)).toEqual({ label: "Valid until 2027-06-01", tone: "neutral" });
  });

  it("queues only files still waiting for a decision, oldest first, naming each supplier", () => {
    expect(pmcmReviewQueue([permit, insurance]).map((entry) => [entry.fileName, entry.sender, entry.requirementLabel])).toEqual([
      ["obj_sonic.pdf", "Sonic Line", "Insurance certificate"],
      ["obj_permit_v2.pdf", "Client", "Venue permit"],
    ]);
  });

  it("filters by what is waiting, by sender and by search text, with a count for each filter", () => {
    const { files } = buildPmcmFileLibrary([
      stored("obj_permit_v2"),
      stored("obj_atlas", { uploaderActorRole: "supplier" }),
      stored("obj_runsheet", { uploaderActorRole: "pmcm-admin", usage: "event_deliverable" }),
    ], [permit, insurance]);

    expect(countPmcmFiles(files)).toEqual({ all: 3, review: 1, client: 1, supplier: 1, pmcm: 1 });
    expect(filterPmcmFiles(files, "review", "").map((file) => file.id)).toEqual(["obj_permit_v2"]);
    expect(filterPmcmFiles(files, "all", "atlas").map((file) => file.id)).toEqual(["obj_atlas"]);
  });
});
