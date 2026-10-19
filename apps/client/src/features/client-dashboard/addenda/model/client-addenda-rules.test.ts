import { describe, expect, it } from "vitest";
import type { PrismAddendum } from "@prism/types";
import { addendaAwaitingClientAcknowledgment, addendumConformeStatusLabel } from "./client-addenda-rules";

function addendum(id: string, conforme: PrismAddendum["conforme"]): PrismAddendum {
  return {
    id, eventId: "evt_1", versionNumber: 2, title: "Lighting", summary: "", status: "issued", documentId: "", documentState: "pending",
    signatureMethod: "scanned_document", comparison: { contract: [], quotes: [] }, financialDelta: 0, issuedAt: "2026-10-19T09:00:00.000Z", conforme,
  };
}

const execution = (status: "awaiting_client" | "awaiting_pmcm" | "completed") => ({
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
  });
});
