/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PmcmLibraryFile, PmcmReviewEntry } from "../model/pmcm-file-library";
import { PmcmFileLibraryView } from "./pmcm-file-library-view";

const { useViewModel } = vi.hoisted(() => ({ useViewModel: vi.fn() }));
vi.mock("../view-models/use-pmcm-file-library-view-model", () => ({ usePmcmFileLibraryViewModel: useViewModel }));
vi.mock("../view-models/use-pmcm-file-preview", () => ({ usePmcmFilePreview: () => ({ status: "loading" }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const entry: PmcmReviewEntry = {
  key: "venue_permit", requirementLabel: "Venue permit", documentId: "doc_2", objectId: "obj_permit",
  fileName: "permit.pdf", sender: "Client", uploadedAt: "2026-11-03T00:00:00.000Z",
};

const file: PmcmLibraryFile = {
  id: "obj_permit", name: "permit.pdf", kind: "pdf", contentType: "application/pdf", size: 2048, source: "client",
  from: "Client", label: "Venue permit", addedAt: "2026-11-03T00:00:00.000Z", status: "Waiting for review", tone: "attention", review: entry,
  expiresAt: "2026-01-31T00:00:00.000Z",
};

function viewModel(overrides: Record<string, unknown> = {}) {
  return {
    loading: false, loadError: null, files: [file], unfinished: [], counts: { all: 1, review: 1, client: 1, supplier: 0, pmcm: 0 },
    queue: [entry], filter: "all", setFilter: vi.fn(), query: "", setQuery: vi.fn(),
    preview: null, openPreview: vi.fn(), closePreview: vi.fn(),
    selected: new Set<string>(), toggleSelected: vi.fn(), toggleAll: vi.fn(), approveSelected: vi.fn(),
    review: vi.fn(), upload: vi.fn(), download: vi.fn(), setExpiry: vi.fn(), makeCover: vi.fn(), removeCover: vi.fn(), coverObjectId: null,
    busy: null, notice: null, error: null, category: "other", setCategory: vi.fn(), inputRef: { current: null },
    ...overrides,
  };
}

describe("PMCM file library", () => {
  it("puts files waiting for review first, and rejecting asks for the reason the sender will read", () => {
    const vm = viewModel();
    useViewModel.mockReturnValue(vm);
    render(<PmcmFileLibraryView eventId="evt_1" />);

    const queue = screen.getByRole("region", { name: "Waiting for review" });
    expect(queue.textContent).toContain("For Venue permit · from Client");
    // A document past its date says so in the table.
    expect(screen.getByText("Expired 2026-01-31")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]!);
    expect(vm.review).toHaveBeenCalledWith(entry, "approve");

    fireEvent.click(screen.getAllByRole("button", { name: "Reject" })[0]!);
    const reject = screen.getAllByRole("button", { name: "Reject" })[0]!;
    expect(reject.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason for rejecting permit.pdf"), { target: { value: "Unsigned" } });
    fireEvent.click(reject);
    expect(vm.review).toHaveBeenCalledWith(entry, "reject", "Unsigned");
  });

  it("approves several files at once once PMCM selects them", () => {
    const vm = viewModel({ selected: new Set(["doc_2"]) });
    useViewModel.mockReturnValue(vm);
    render(<PmcmFileLibraryView eventId="evt_1" />);

    fireEvent.click(screen.getByRole("button", { name: "Approve 1 selected" }));
    expect(vm.approveSelected).toHaveBeenCalled();
  });

  it("keeps uploads that never finished out of the table, with the reason they failed", () => {
    useViewModel.mockReturnValue(viewModel({
      queue: [],
      files: [{ ...file, review: undefined, status: "Approved", tone: "done" }],
      unfinished: [{ id: "obj_failed", originalFileName: "b.pdf", lifecycleState: "failed", failureReason: "Storage provider could not issue an upload location" }],
    }));
    render(<PmcmFileLibraryView eventId="evt_1" />);

    expect(screen.queryByRole("region", { name: "Waiting for review" })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Download / }).map((button) => button.getAttribute("aria-label"))).toEqual(["Download permit.pdf"]);
    expect(screen.getByText("1 upload didn't finish")).toBeTruthy();
    expect(screen.getByText("b.pdf · Failed: Storage provider could not issue an upload location")).toBeTruthy();
  });

  it("lets PMCM make an image the event's cover from its preview, and offers it only for images", () => {
    const photo: PmcmLibraryFile = { ...file, id: "obj_venue", name: "venue.jpg", kind: "image", contentType: "image/jpeg", review: undefined, status: "Shared", label: null, expiresAt: null };
    const vm = viewModel({ files: [photo], queue: [], preview: photo });
    useViewModel.mockReturnValue(vm);
    const view = render(<PmcmFileLibraryView eventId="evt_1" />);
    fireEvent.click(screen.getByRole("button", { name: "Use as event cover" }));
    expect(vm.makeCover).toHaveBeenCalledWith(photo);

    // Once it is the cover, the same place takes it off again.
    const covered = viewModel({ files: [photo], queue: [], preview: photo, coverObjectId: "obj_venue" });
    useViewModel.mockReturnValue(covered);
    view.rerender(<PmcmFileLibraryView eventId="evt_1" />);
    expect(screen.queryByRole("button", { name: "Use as event cover" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove as event cover" }));
    expect(covered.removeCover).toHaveBeenCalledWith(photo);

    useViewModel.mockReturnValue(viewModel({ preview: file }));
    view.rerender(<PmcmFileLibraryView eventId="evt_1" />);
    expect(screen.queryByRole("button", { name: /event cover/ })).toBeNull();
  });
});
