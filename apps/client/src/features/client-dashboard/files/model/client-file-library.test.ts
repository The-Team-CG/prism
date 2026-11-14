import { describe, expect, it } from "vitest";
import type { PrismDocument, PrismFileRequirementItem, PrismStoredObject } from "@prism/types";
import {
  CLIENT_ARCHIVE_WARNING_BYTES,
  buildClientFileLibrary,
  clientArchiveEntries,
  clientArchiveTotalBytes,
  clientFileFilterForView,
  clientFileKind,
  countClientFiles,
  filterClientLibrary,
  formatFileSize,
  isNewClientFile,
  searchClientAccountFiles,
  sortClientLibrary,
} from "./client-file-library";

const doc = (id: string, type: string, fileName = `${id}.pdf`, uploadedAt = "2026-10-28T12:00:00Z"): PrismDocument =>
  ({ id, eventId: "event-a", type, fileName, status: "approved", uploadedAt });
const object = (id: string, patch: Partial<PrismStoredObject> = {}) =>
  ({ id, originalFileName: `${id}.pdf`, usage: "client_document", uploaderActorRole: "client", lifecycleState: "stored", storedAt: "2026-11-01T00:00:00Z", createdAt: "2026-11-01T00:00:00Z", ...patch }) as PrismStoredObject;
const requirement = (key: string, patch: Partial<PrismFileRequirementItem> = {}) =>
  ({ key, label: key, ownerRole: "client", origin: "custom", status: "submitted", required: true, overdue: false, ...patch }) as PrismFileRequirementItem;

describe("client file library", () => {
  it("files each record on its shelf and opens named routes on that shelf", () => {
    const files = buildClientFileLibrary([], [doc("permit", "venue_permit"), doc("conforme", "signed_conforme"), doc("statement", "billing_statement"), doc("plan", "other", "main-hall-layout.pdf")], []);
    const counts = countClientFiles(files);

    expect(filterClientLibrary(files, "files-contracts", "").map((file) => file.id)).toEqual(["conforme"]);
    expect(filterClientLibrary(files, "files-invoices-receipts", "").map((file) => file.id)).toEqual(["statement"]);
    expect(filterClientLibrary(files, "files-event-layouts", "").map((file) => file.id)).toEqual(["plan"]);
    expect(counts).toMatchObject({ all: 4, "files-quotations": 0, other: 1 });
    expect(clientFileFilterForView("files-quotations")).toBe("files-quotations");
    expect(clientFileFilterForView("files-all")).toBe("all");
  });

  it("shows who added each upload and the review state of the requirement it was sent for", () => {
    const files = buildClientFileLibrary(
      [
        object("obj_permit", { originalFileName: "permit.pdf" }),
        object("obj_rejected", { originalFileName: "insurance.pdf", declaredByteSize: 2_500_000 }),
        object("obj_shared", { originalFileName: "Run-of-show.pdf", usage: "event_deliverable", uploaderActorRole: "pmcm-admin" }),
        object("obj_gone", { lifecycleState: "deleted" }),
      ],
      [],
      [
        requirement("Venue permit", { uploadedObjectId: "obj_permit" }),
        requirement("Insurance", {
          uploadedObjectId: "obj_rejected",
          status: "missing",
          validationStatus: "rejected",
          reviewReason: "Policy has expired",
          versions: [{ documentId: "d2", objectId: "obj_rejected", fileName: "insurance.pdf", uploadedAt: "2026-11-02T00:00:00Z", status: "rejected" }],
        }),
      ],
    );
    const byId = new Map(files.map((file) => [file.id, file]));

    expect(byId.has("obj_gone")).toBe(false);
    expect(byId.get("obj_permit")).toMatchObject({ addedBy: "You", status: "In review", requirementLabel: "Venue permit", objectId: "obj_permit" });
    expect(byId.get("obj_rejected")).toMatchObject({ status: "Not accepted", tone: "urgent", reviewReason: "Policy has expired", replaceable: true, requirementKey: "Insurance" });
    expect(byId.get("obj_rejected")?.versions).toHaveLength(1);
    expect(formatFileSize(byId.get("obj_rejected")?.size)).toBe("2.4 MB");
    expect(byId.get("obj_permit")).not.toHaveProperty("reviewReason", expect.anything());
    expect(byId.get("obj_shared")).toMatchObject({ addedBy: "PMCM", status: "Shared with you" });
  });

  it("lists a PMCM record once when its file is also stored, keeps newest first, and searches by name or requirement", () => {
    const files = buildClientFileLibrary(
      [object("obj_conforme", { originalFileName: "Signed-Conforme.pdf", usage: "signed_conforme", storedAt: "2026-10-01T00:00:00Z" })],
      [doc("doc_conforme", "signed_conforme", "signed-conforme.pdf"), doc("doc_statement", "billing_statement", "statement.pdf", "2026-11-05T00:00:00Z")],
      [requirement("Guest list", { uploadedObjectId: "obj_conforme" })],
    );

    expect(files.map((file) => file.id)).toEqual(["doc_statement", "obj_conforme"]);
    expect(files[1].category).toBe("files-contracts");
    expect(filterClientLibrary(files, "all", "guest").map((file) => file.id)).toEqual(["obj_conforme"]);
  });

  it("tells file types apart for icons and preview, and sorts by name or date", () => {
    expect([clientFileKind("plan.PDF"), clientFileKind("photo", "image/jpeg"), clientFileKind("guests.xlsx"), clientFileKind("brief.docx"), clientFileKind("walkthrough.mov"), clientFileKind("archive.zip")])
      .toEqual(["pdf", "image", "sheet", "document", "video", "other"]);

    const files = buildClientFileLibrary([], [doc("b", "other", "file-10.pdf", "2026-10-01T00:00:00Z"), doc("a", "other", "file-9.pdf", "2026-10-02T00:00:00Z")], []);
    expect(sortClientLibrary(files, { key: "name", direction: "asc" }).map((file) => file.name)).toEqual(["file-9.pdf", "file-10.pdf"]);
    expect(sortClientLibrary(files, { key: "date", direction: "asc" }).map((file) => file.id)).toEqual(["b", "a"]);
  });

  it("marks only what someone else added since the previous visit, and nothing on a first visit", () => {
    const shared = { addedBy: "PMCM", addedAt: "2026-11-10T00:00:00Z" };
    expect(isNewClientFile(shared, "2026-11-09T00:00:00.000Z")).toBe(true);
    expect(isNewClientFile(shared, "2026-11-11T00:00:00.000Z")).toBe(false);
    expect(isNewClientFile({ ...shared, addedBy: "You" }, "2026-11-09T00:00:00.000Z")).toBe(false);
    expect(isNewClientFile(shared, null)).toBe(false);
  });

  it("searches every event's files, naming each result's event, and files downloads under their shelf", () => {
    const results = searchClientAccountFiles(
      [
        { eventId: "a", eventName: "Gala", objects: [object("o1", { originalFileName: "Venue-Permit.pdf", storedAt: "2026-10-01T00:00:00Z" })], documents: [] },
        { eventId: "b", eventName: "Summit", objects: [object("o2", { originalFileName: "permit-2027.pdf", storedAt: "2026-11-01T00:00:00Z" }), object("o3", { originalFileName: "menu.pdf" })], documents: [] },
      ],
      "permit",
    );
    expect(results.map((file) => [file.name, file.eventName])).toEqual([["permit-2027.pdf", "Summit"], ["Venue-Permit.pdf", "Gala"]]);
    expect(searchClientAccountFiles([{ eventId: "a", eventName: "Gala", objects: [object("o1")], documents: [] }], "  ")).toEqual([]);

    const library = buildClientFileLibrary(
      [object("o4", { originalFileName: "Signed-Contract.pdf", declaredByteSize: 200 * 1024 * 1024 }), object("o5", { originalFileName: "Walkthrough.mp4", declaredByteSize: 150 * 1024 * 1024 })],
      [doc("d1", "billing_statement", "statement.pdf")],
      [],
    );
    const entries = clientArchiveEntries(library);
    expect(entries.map(({ objectId, folder }) => [objectId, folder])).toEqual([["o4", "Contracts"], ["o5", "Other"]]);
    expect(clientArchiveTotalBytes(entries)).toBeGreaterThan(CLIENT_ARCHIVE_WARNING_BYTES);
    expect(clientArchiveTotalBytes(entries.slice(1))).toBeLessThan(CLIENT_ARCHIVE_WARNING_BYTES);
  });

  it("labels an earlier upload that a newer file replaced, keeping PMCM's reason for it", () => {
    const files = buildClientFileLibrary(
      [object("obj_v1", { originalFileName: "guest-list.pdf" }), object("obj_v2", { originalFileName: "guest-list-final.pdf" })],
      [],
      [requirement("Guest list", {
        uploadedObjectId: "obj_v2",
        versions: [
          { documentId: "d2", objectId: "obj_v2", fileName: "guest-list-final.pdf", uploadedAt: "2026-11-02T00:00:00Z", status: "submitted" },
          { documentId: "d1", objectId: "obj_v1", fileName: "guest-list.pdf", uploadedAt: "2026-11-01T00:00:00Z", status: "rejected", reviewReason: "Missing dietary column" },
        ],
      })],
    );
    const byId = new Map(files.map((file) => [file.id, file]));
    expect(byId.get("obj_v2")).toMatchObject({ status: "In review", requirementLabel: "Guest list", replaceable: true });
    expect(byId.get("obj_v1")).toMatchObject({ status: "Replaced", tone: "neutral", requirementLabel: "Guest list", reviewReason: "Missing dietary column" });
    expect(byId.get("obj_v1")?.replaceable).toBeUndefined();
  });
});
