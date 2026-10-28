import { describe, expect, it } from "vitest";
import type { PrismFileRequirementItem, PrismStoredObject } from "@prism/types";
import { buildClientDocumentChecklist, clientRequirementReviewLabel } from "./client-document-checklist";

const requirement = (key: string, patch: Partial<PrismFileRequirementItem> = {}) =>
  ({ key, label: key, ownerRole: "client", visibleToRoles: ["client"], origin: "custom", status: "missing", required: true, overdue: false, ...patch }) as PrismFileRequirementItem;
const file = (id: string, usage = "client_document") => ({ id, originalFileName: `${id}.pdf`, usage, lifecycleState: "stored" }) as PrismStoredObject;

describe("client document checklist", () => {
  it("shows each upload beside the requirement it fulfils and keeps unlinked files apart", () => {
    const { rows, otherFiles } = buildClientDocumentChecklist(
      [requirement("venue_permit", { status: "submitted", uploadedObjectId: "obj_permit" }), requirement("insurance")],
      [file("obj_permit"), file("obj_loose"), file("obj_shared", "event_deliverable")],
    );

    const permit = rows.find((row) => row.requirement.key === "venue_permit");
    expect(permit?.file?.id).toBe("obj_permit");
    expect(clientRequirementReviewLabel(permit!)).toBe("Sent, waiting for PMCM review");
    expect(otherFiles.map((entry) => entry.id)).toEqual(["obj_loose", "obj_shared"]);
  });

  it("puts what the client still owes first, including a rejected upload that needs replacing", () => {
    const { rows } = buildClientDocumentChecklist(
      [
        requirement("conforme", { origin: "derived", ownerRole: "pmcm-admin", status: "approved" }),
        requirement("approved_permit", { status: "approved" }),
        requirement("rejected_permit", { status: "missing", validationStatus: "rejected" }),
      ],
      [],
    );

    expect(rows[0].requirement.key).toBe("rejected_permit");
    expect(rows[0].needsClient).toBe(true);
    expect(clientRequirementReviewLabel(rows[0])).toBe("Not accepted. Upload a replacement");
    expect(rows.find((row) => row.requirement.key === "conforme")?.uploadable).toBe(false);
  });
});
