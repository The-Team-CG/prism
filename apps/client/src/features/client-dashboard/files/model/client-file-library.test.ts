import { describe, expect, it } from "vitest";
import type { PrismDocument, PrismFileRequirementItem, PrismStoredObject } from "@prism/types";
import { buildClientFileLibrary, clientFileFilterForView, countClientFiles, filterClientLibrary } from "./client-file-library";

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
        object("obj_rejected", { originalFileName: "insurance.pdf" }),
        object("obj_shared", { originalFileName: "Run-of-show.pdf", usage: "event_deliverable", uploaderActorRole: "pmcm-admin" }),
        object("obj_gone", { lifecycleState: "deleted" }),
      ],
      [],
      [requirement("Venue permit", { uploadedObjectId: "obj_permit" }), requirement("Insurance", { uploadedObjectId: "obj_rejected", validationStatus: "rejected" })],
    );
    const byId = new Map(files.map((file) => [file.id, file]));

    expect(byId.has("obj_gone")).toBe(false);
    expect(byId.get("obj_permit")).toMatchObject({ addedBy: "You", status: "In review", requirementLabel: "Venue permit", objectId: "obj_permit" });
    expect(byId.get("obj_rejected")).toMatchObject({ status: "Not accepted", tone: "urgent" });
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
});
