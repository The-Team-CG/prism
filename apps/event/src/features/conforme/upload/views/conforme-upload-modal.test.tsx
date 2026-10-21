/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismConformeExecution, PrismInquiry } from "@prism/types";
import { ConformeUploadModal } from "./conforme-upload-modal";

afterEach(cleanup);

const inquiry: PrismInquiry = {
  id: "inq_1",
  clientName: "Ana Reyes",
  companyName: "Ayala Corporation",
  email: "ana@ayala.test",
  eventName: "Signing acceptance",
  eventType: "Conference",
  eventDate: "2031-04-19",
  clientType: "Corporate",
  source: "Website",
  message: "",
  status: "accepted",
  createdAt: "2026-10-16T00:00:00.000Z",
};

function execution(status: PrismConformeExecution["status"], version = 1): PrismConformeExecution {
  const clientSignature = {
    id: "cfs_client",
    actorRole: "client",
    actorName: "Ana Reyes",
    consentTextVersion: "1",
    signedAt: "2026-10-16T01:00:00.000Z",
  };
  return {
    id: `cfx_${version}`,
    inquiryId: inquiry.id,
    eventId: null,
    templateVersion: version,
    templateSha256: "a".repeat(64),
    documentContent: "CONFORME — Signing acceptance",
    documentSha256: "b".repeat(64),
    status,
    createdAt: "2026-10-16T00:00:00.000Z",
    completedAt: status === "completed" ? "2026-10-16T02:00:00.000Z" : null,
    signatures: status === "awaiting_pmcm" || status === "completed" ? [clientSignature] : [],
  };
}

function renderModal(overrides: Partial<Parameters<typeof ConformeUploadModal>[0]> = {}) {
  const props = {
    inquiry,
    onUpload: vi.fn(async () => {}),
    onPrepareDigital: vi.fn(async () => execution("awaiting_client", 2)),
    onRefreshDigital: vi.fn(async () => execution("awaiting_client")),
    onSignDigital: vi.fn(async () => execution("completed")),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<ConformeUploadModal {...props} />);
  return props;
}

describe("ConformeUploadModal", () => {
  it("loads a client-signed execution after reopening and exposes PMCM countersignature", async () => {
    const latest = execution("awaiting_pmcm");
    const props = renderModal({ onRefreshDigital: vi.fn(async () => latest) });

    expect(await screen.findByText("In-app conforme · version 1")).toBeTruthy();
    expect(screen.getByText("The client has acknowledged this version. Review the document and countersign to activate the client workspace.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Prepare replacement version" })).toBeNull();
    expect(screen.getByRole("button", { name: "Countersign and activate" }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByLabelText("I reviewed this exact version and approve the in-app record."));
    fireEvent.click(screen.getByRole("button", { name: "Countersign and activate" }));
    await waitFor(() => expect(props.onSignDigital).toHaveBeenCalledWith(latest));
    expect(await screen.findByText("Both acknowledgments are recorded; the client workspace is active.")).toBeTruthy();
  });

  it("keeps first-time preparation available when no execution exists", async () => {
    const notFound = Object.assign(new Error("not found"), { status: 404 });
    const props = renderModal({ onRefreshDigital: vi.fn().mockRejectedValue(notFound) });

    await waitFor(() => expect(props.onRefreshDigital).toHaveBeenCalledTimes(1));
    const prepare = await screen.findByRole("button", { name: "Prepare in-app conforme" });
    await waitFor(() => expect(prepare.hasAttribute("disabled")).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(prepare);
    expect(await screen.findByText("In-app conforme · version 2")).toBeTruthy();
    expect(props.onPrepareDigital).toHaveBeenCalledTimes(1);
  });

  it("offers replacement only while the current version has no signatures", async () => {
    const props = renderModal({ onRefreshDigital: vi.fn(async () => execution("awaiting_client")) });

    fireEvent.click(await screen.findByRole("button", { name: "Prepare replacement version" }));
    expect(await screen.findByText("In-app conforme · version 2")).toBeTruthy();
    expect(props.onPrepareDigital).toHaveBeenCalledTimes(1);
  });
});
