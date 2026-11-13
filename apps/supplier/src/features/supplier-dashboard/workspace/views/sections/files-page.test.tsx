/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilesPage } from "./files-page";

const { useViewModel } = vi.hoisted(() => ({ useViewModel: vi.fn() }));
vi.mock("../../view-models/use-supplier-file-library-view-model", () => ({
  useSupplierFileLibraryViewModel: useViewModel,
  useSupplierFilePreview: () => ({ status: "none" }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const insurance = { eventId: "evt_gala", eventName: "Founders Gala", key: "insurance", label: "Insurance certificate", reviewReason: "Policy has expired", dueDate: null, overdue: true, replacing: true };
const contract = { eventId: "evt_gala", eventName: "Founders Gala", key: "supplier-contract:req_1", label: "Signed contract", overdue: false, replacing: false, bookingRequestId: "req_1" };

function viewModel() {
  return {
    status: "ready", error: null, uploading: null, upload: vi.fn(), needed: [insurance, contract],
    files: [], counts: { all: 0, booking: 0, contract: 0, certification: 0 }, filter: "all", setFilter: vi.fn(), query: "", setQuery: vi.fn(),
    preview: null, openPreview: vi.fn(), closePreview: vi.fn(),
  };
}

function renderPage() {
  render(<FilesPage workspace={{} as never} session={{} as never} workflowWorkspace={null} readinessBoard={null} onDownloadObject={vi.fn()} />);
}

describe("supplier Files page", () => {
  it("lets the supplier date a booking document they sent, from its preview", () => {
    const permit = { id: "doc_3", name: "permit.pdf", kind: "pdf", group: "booking", context: "Founders Gala · Work permit", addedAt: "2026-11-04T00:00:00.000Z", status: "Approved", tone: "done", objectId: "obj_3", expiresAt: "2026-11-30T00:00:00.000Z", datable: true };
    const vm = { ...viewModel(), needed: [], files: [permit], preview: permit, setExpiry: vi.fn(), saving: false };
    useViewModel.mockReturnValue(vm);
    renderPage();

    const field = screen.getByLabelText("Valid until for permit.pdf") as HTMLInputElement;
    expect(field.value).toBe("2026-11-30");
    fireEvent.change(field, { target: { value: "2027-11-30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(vm.setExpiry).toHaveBeenCalledWith(permit, "2027-11-30");
  });

  it("sends a file dropped on a needed item for that requirement, and sends contracts to their booking", () => {
    const vm = viewModel();
    useViewModel.mockReturnValue(vm);
    renderPage();

    expect(screen.getByText("PMCM: Policy has expired")).toBeTruthy();
    const file = new File(["%PDF"], "insurance-2026.pdf", { type: "application/pdf" });
    fireEvent.drop(screen.getByText("Insurance certificate").closest("li")!, { dataTransfer: { files: [file] } });
    expect(vm.upload).toHaveBeenCalledWith("evt_gala", "insurance", file);

    expect(screen.getByRole("link", { name: "Open booking" }).getAttribute("href")).toContain("req_1");
    fireEvent.drop(screen.getByText("Signed contract").closest("li")!, { dataTransfer: { files: [file] } });
    expect(vm.upload).toHaveBeenCalledTimes(1);
  });
});
