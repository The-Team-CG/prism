import { describe, expect, it } from "vitest";
import type { PrismAddendum, PrismAddendumConformeStatus } from "@prism/types";
import { addendaAwaitingClientAcknowledgment, addendumConformeStatusLabel, addendumStatusLabel } from "./client-addenda-rules";

function addendum(id: string, conforme: PrismAddendum["conforme"]): PrismAddendum {
  return {
    id, eventId: "evt_1", versionNumber: 2, title: "Lighting", summary: "", status: "pending", documentId: "", documentState: "pending",
    signatureMethod: "scanned_document", comparison: { contract: [], quotes: [] }, financialDelta: 0, issuedAt: "2026-10-19T09:00:00.000Z",
    effectiveAt: null, withdrawnAt: null, withdrawalReason: null, plannedImpacts: null, conforme,
  };
}

const execution = (status: PrismAddendumConformeStatus) => ({
  id: "acx_1", addendumId: "addendum_1", eventId: "evt_1", versionNumber: 2, documentContent: "ADDENDUM CONFORME", documentSha256: "a".repeat(64),
  status, createdAt: "2026-10-19T09:00:00.000Z", completedAt: null, signatures: [],
});

describe("client addenda rules", () => {
  it("offers acknowledgment only for addenda whose conforme is waiting on the client", () => {
    const awaiting = addendum("addendum_1", execution("awaiting_client"));
    const pending = addendum("addendum_2", execution("awaiting_pmcm"));
    const notRequested = addendum("addendum_3", null);

    expect(addendaAwaitingClientAcknowledgment([awaiting, pending, notRequested])).toEqual([awaiting]);
  });

  it("explains where a conforme stands without exposing the other party's signing step", () => {
    expect(addendumConformeStatusLabel(null)).toBe("Conforme not requested yet");
    expect(addendumConformeStatusLabel(execution("awaiting_client"))).toBe("Awaiting your acknowledgment");
    expect(addendumConformeStatusLabel(execution("awaiting_pmcm"))).toMatch(/Awaiting PMCM countersignature/);
    expect(addendumConformeStatusLabel(execution("completed"))).toBe("Executed by you and PMCM");
    expect(addendumConformeStatusLabel(execution("withdrawn"))).toBe("Withdrawn. No acknowledgment is needed.");
  });

  it("shows pending, effective, and withdrawn states, and gives the client the PMCM withdrawal reason", () => {
    expect(addendumStatusLabel({ status: "pending", withdrawalReason: null })).toBe("Pending. Takes effect when PMCM countersigns.");
    expect(addendumStatusLabel({ status: "effective", withdrawalReason: null })).toBe("Effective. The billing reflects this change.");
    expect(addendumStatusLabel({ status: "withdrawn", withdrawalReason: "Venue cannot take the rig" })).toBe("Withdrawn by PMCM: Venue cannot take the rig");
  });
});
