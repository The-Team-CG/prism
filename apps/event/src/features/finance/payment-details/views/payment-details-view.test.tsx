/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PrismApiError } from "@prism/api-client";
import { PortalQueryProvider } from "@prism/portal-query";
import type { PaymentMethod, PrismPaymentDetails } from "@prism/types";

const { read, save, uploadQr, qrImage, toast } = vi.hoisted(() => ({
  read: vi.fn(), save: vi.fn(), uploadQr: vi.fn(), qrImage: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
const detailsFetch = vi.hoisted(() => vi.fn());

vi.mock("../data/payment-details-repository", () => ({
  financePaymentDetails: { name: "finance.payment-details", staleMs: 15_000, fetch: detailsFetch },
  paymentDetailsCommands: { read, save, uploadQr, qrImage },
}));
vi.mock("@prism/ui/components/sonner", () => ({ toast }));

import { PaymentDetailsView } from "./payment-details-view";

beforeAll(() => {
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:qr"), revokeObjectURL: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: () => false });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const bpi: PaymentMethod = { kind: "bank", id: "00000000-0000-4000-8000-000000000001", label: "BPI", accountName: "PMCM Events", accountNumber: "1234 5678 90", instructions: "", qrImageId: null, enabled: true };
const gcash: PaymentMethod = { kind: "ewallet", id: "00000000-0000-4000-8000-000000000002", label: "GCash", accountName: "PMCM Finance", accountNumber: "0917 123 4567", instructions: "", qrImageId: "pqr_a", enabled: true };

function renderView(details: PrismPaymentDetails) {
  detailsFetch.mockResolvedValue(details);
  read.mockResolvedValue(details);
  qrImage.mockResolvedValue({ blob: new Blob(["png"], { type: "image/png" }), fileName: "payment-qr" });
  render(<PortalQueryProvider actorKey="mys@pmcm.test"><PaymentDetailsView /></PortalQueryProvider>);
}

const saved = (revision: number, methods: PaymentMethod[]): PrismPaymentDetails => ({ revision, methods, updatedBy: "Ms. Mys", updatedAt: "2026-11-15T00:00:00.000Z" });

async function openAndFill(label: RegExp, value: string) {
  const field = await screen.findByLabelText(label);
  fireEvent.change(field, { target: { value } });
}

describe("PMCM payment details screen", () => {
  it("confirms before changing an account number, saves on the revision it loaded, and shows the client's view", async () => {
    save.mockResolvedValue(saved(3, [{ ...bpi, accountNumber: "9999" }, gcash]));
    renderView(saved(2, [bpi, gcash]));

    const preview = within(await screen.findByText("What the client sees").then((heading) => heading.closest("div")!.parentElement as HTMLElement));
    expect(preview.getByText(/1234 5678 90/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^BPI/ }));
    await openAndFill(/Account number/, "9999");
    expect(screen.getByText(/Unsaved changes/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText(/new BPI account number/)).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole("button", { name: "Save the change" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith({ expectedRevision: 2, methods: [{ ...bpi, accountNumber: "9999" }, gcash] }));
    expect(toast.success).toHaveBeenCalledWith("Payment details saved. Clients see them now.");
    await waitFor(() => expect(screen.queryByText(/Unsaved changes/)).toBeNull());
  });

  it("says plainly when someone else saved first, and drops the edits only when asked to reload", async () => {
    save.mockRejectedValue(new PrismApiError(409, { message: "PMCM payment details changed (last by Maxine) since you opened them; reload and try again" }));
    renderView(saved(1, [bpi]));

    fireEvent.click(await screen.findByRole("button", { name: /^BPI/ }));
    await openAndFill(/Name clients see/, "BPI Savings");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect((await screen.findAllByRole("alert")).map((alert) => alert.textContent).join(" ")).toMatch(/last by Maxine/);
    read.mockResolvedValue(saved(2, [{ ...bpi, label: "BPI (Maxine)" }]));
    fireEvent.click(screen.getByRole("button", { name: "Reload and lose my changes" }));

    await waitFor(() => expect(screen.getByRole("button", { name: /^BPI \(Maxine\)/ })).toBeTruthy());
    expect(screen.queryByText(/Unsaved changes/)).toBeNull();
  });

  it("starts empty with a warning for clients, and will not save an account that is missing its number", async () => {
    save.mockResolvedValue(saved(1, []));
    renderView(saved(0, []));

    expect(await screen.findByText(/Statements cannot be issued until at least one account is added/)).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("button", { name: /Add the first one/ }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Bank account" }));

    await openAndFill(/Account name/, "PMCM Events");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect((await screen.findAllByRole("alert")).map((alert) => alert.textContent).join(" ")).toMatch(/Bank transfer: Enter the account number\./);
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Account number/), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ expectedRevision: 0, methods: [expect.objectContaining({ kind: "bank", accountName: "PMCM Events", accountNumber: "1234", enabled: true })] }));
  });

  it("uploads a QR for an account and refuses a file that is not a PNG or JPEG, or too large", async () => {
    uploadQr.mockResolvedValue({ id: "pqr_new", contentType: "image/png", byteSize: 3 });
    renderView(saved(1, [bpi]));

    fireEvent.click(await screen.findByRole("button", { name: /^BPI/ }));
    const input = await screen.findByLabelText("QR image file");
    fireEvent.change(input, { target: { files: [new File(["gif"], "qr.gif", { type: "image/gif" })] } });
    expect(toast.error).toHaveBeenCalledWith("Choose a PNG or JPEG image.");
    fireEvent.change(input, { target: { files: [new File([new Uint8Array(1024 * 1024 + 1)], "big.png", { type: "image/png" })] } });
    expect(toast.error).toHaveBeenCalledWith("The QR image must be 1 MB or smaller.");
    expect(uploadQr).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { files: [new File(["png"], "qr.png", { type: "image/png" })] } });
    await waitFor(() => expect(uploadQr).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(qrImage).toHaveBeenCalledWith("pqr_new"));
    expect(await screen.findByRole("button", { name: "Replace QR" })).toBeTruthy();
    expect(screen.getByText(/Unsaved changes/)).toBeTruthy();
  });
});
