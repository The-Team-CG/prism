/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismStoredObject } from "@prism/types";
import { PmcmDocumentHubView } from "./pmcm-document-hub-view";

const { useViewModel } = vi.hoisted(() => ({ useViewModel: vi.fn() }));
vi.mock("../view-models/use-pmcm-document-hub-view-model", () => ({
  usePmcmDocumentHubViewModel: useViewModel,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function storedObject(lifecycleState: PrismStoredObject["lifecycleState"]): PrismStoredObject {
  return {
    id: `object-${lifecycleState}`,
    eventId: "event-1",
    ownerRecordType: "event_deliverable",
    ownerRecordId: "event-1",
    logicalTarget: "client-deliverable",
    usage: "event_deliverable",
    originalFileName: "run-of-show.pdf",
    contentType: "application/pdf",
    declaredByteSize: 120,
    checksumSha256: "a".repeat(64),
    uploaderActorId: "pmcm-1",
    uploaderActorRole: "pmcm-admin",
    lifecycleState,
    providerName: "local-filesystem-development",
    providerObjectKey: "objects/run-of-show.pdf",
    failureReason: null,
    requestedAt: "2026-10-16T00:00:00.000Z",
    storedAt: lifecycleState === "stored" ? "2026-10-16T00:00:01.000Z" : null,
    failedAt: null,
    deletedAt: null,
    createdAt: "2026-10-16T00:00:00.000Z",
    updatedAt: "2026-10-16T00:00:01.000Z",
  };
}

describe("PMCM document hub download availability", () => {
  it("shows download only after storage confirmation and leaves it enabled when stored", () => {
    useViewModel.mockReturnValue({
      inputRef: { current: null },
      documents: [storedObject("requested"), storedObject("stored")],
      busy: false,
      downloading: null,
      error: null,
      upload: vi.fn(),
      download: vi.fn(),
    });

    render(<PmcmDocumentHubView eventId="event-1" />);

    expect(screen.getByRole("button", { name: "Download run-of-show.pdf" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getAllByText("run-of-show.pdf")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Download run-of-show.pdf" })).toHaveLength(1);
    // Metadata uses product terms rather than stored enum values.
    expect(screen.getByText("Event deliverable · Upload not finished")).toBeTruthy();
    expect(screen.getByText("Event deliverable · Stored")).toBeTruthy();
  });
});
