/** @vitest-environment jsdom */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { PaymentMethod } from "@prism/types";

const { paymentQr } = vi.hoisted(() => ({ paymentQr: vi.fn() }));
vi.mock("../data/billing-documents-repository", () => ({ billingDocumentsRepository: { paymentQr } }));

import { HowToPay } from "./how-to-pay";

const clipboard = { writeText: vi.fn(async (_text: string) => undefined) };
const downloads: Array<{ name: string; href: string }> = [];

beforeAll(() => {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:qr"), revokeObjectURL: vi.fn() });
});
// The client config restores spies after every test, so the download spy is set before each one.
beforeEach(() => {
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { downloads.push({ name: this.download, href: this.href }); });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  downloads.length = 0;
});

const bpi: PaymentMethod = { kind: "bank", id: "00000000-0000-4000-8000-000000000001", label: "BPI", accountName: "PMCM Events Inc.", accountNumber: "0123-4567-89", instructions: "Use the statement number", qrImageId: null, enabled: true };
const gcash: PaymentMethod = { kind: "ewallet", id: "00000000-0000-4000-8000-000000000002", label: "GCash", accountName: "PMCM Events", accountNumber: "0917 555 0100", instructions: "", qrImageId: "pqr_a", enabled: true };

function open(props: Partial<Parameters<typeof HowToPay>[0]> = {}) {
  render(<HowToPay eventId="evt_1" payTo={[bpi, gcash]} changedSinceIssued={false} statementNumber="BS-2026-0003" amount={50000} messagesHref="/dashboard/messages" {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "How to pay" }));
  return within(screen.getByRole("dialog"));
}

describe("How to pay", () => {
  it("lets the client copy the amount as a plain number, the reference, and each value of an account on its own", async () => {
    const dialog = open();

    expect(dialog.getByText("₱50,000")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Copy amount to send" }));
    fireEvent.click(dialog.getByRole("button", { name: "Copy reference to write" }));
    fireEvent.click(dialog.getByRole("button", { name: "Copy account number" }));
    fireEvent.click(dialog.getByRole("button", { name: "Copy account name" }));

    await waitFor(() => expect(clipboard.writeText.mock.calls.map(([text]) => text)).toEqual(["50000", "BS-2026-0003", "0123-4567-89", "PMCM Events Inc."]));
    expect(dialog.getByText("Use the statement number")).toBeTruthy();
    // The first account is open; no QR is asked for until the account that has one is showing.
    expect(paymentQr).not.toHaveBeenCalled();
  });

  it("shows an account's QR only when its tab is open, and saves it under the account's name", async () => {
    paymentQr.mockResolvedValue({ blob: new Blob(["png"], { type: "image/png" }), fileName: "payment-qr" });
    const dialog = open();

    fireEvent.mouseDown(dialog.getByRole("tab", { name: "GCash" }), { button: 0 });

    expect((await dialog.findByAltText("GCash payment QR")).getAttribute("src")).toBe("blob:qr");
    expect(paymentQr).toHaveBeenCalledWith("evt_1", "pqr_a");
    expect(dialog.getByText("0917 555 0100")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: /Save QR/ }));
    expect(downloads.map((download) => download.name)).toEqual(["payment-qr-gcash.png"]);
  });

  it("says plainly when the QR cannot be loaded, and keeps the account number to use instead", async () => {
    paymentQr.mockRejectedValue(new Error("Payment QR image not found"));
    const dialog = open({ payTo: [gcash] });

    expect(await dialog.findByText(/QR could not be loaded/)).toBeTruthy();
    expect(dialog.getByText("0917 555 0100")).toBeTruthy();
    expect(dialog.queryByRole("button", { name: /Save QR/ })).toBeNull();
  });

  it("warns when PMCM changed its details after the statement was issued, and only then", () => {
    cleanup();
    expect(open({ changedSinceIssued: true }).getByRole("status").textContent).toContain("updated its payment details after this statement was issued");
    cleanup();
    expect(open({ changedSinceIssued: false }).queryByRole("status")).toBeNull();
  });

  it("sends the client to PMCM, not to a made-up account, when nothing has been set up", () => {
    const dialog = open({ payTo: [] });

    expect(dialog.getByText(/message PMCM before sending any money/i)).toBeTruthy();
    expect(dialog.getByRole("link", { name: "Message PMCM" }).getAttribute("href")).toBe("/dashboard/messages");
    expect(dialog.queryByRole("tab")).toBeNull();
    expect(dialog.queryByText(/Account number/)).toBeNull();
  });
});
