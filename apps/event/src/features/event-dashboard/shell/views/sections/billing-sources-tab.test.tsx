/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PortalQueryProvider } from "@prism/portal-query";
import type { PaymentMethod, PrismBillingSource } from "@prism/types";

const detailsFetch = vi.hoisted(() => vi.fn());
vi.mock("@/features/finance/payment-details/data/payment-details-repository", () => ({
  financePaymentDetails: { name: "finance.payment-details", staleMs: 15_000, fetch: detailsFetch },
  paymentDetailsCommands: {},
}));

import { BillingSourcesTab } from "./billing-sources-tab";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const bpi: PaymentMethod = { kind: "bank", id: "00000000-0000-4000-8000-000000000001", label: "BPI", accountName: "PMCM Events", accountNumber: "1234", instructions: "", qrImageId: null, enabled: true };

const approvedSource = {
  id: "src_1", eventId: "evt_1", sourceType: "ce_proposal", sourceLabel: "Approved proposal", sourceDocumentId: null, lineItems: [{ label: "Package", amount: 100000 }],
  paymentSchedule: [], totalAmount: 100000, status: "approved", approvedAt: null, approvedBy: null, approvalNotes: "", createdAt: "", updatedAt: "",
} as unknown as PrismBillingSource;

function renderTab(methods: PaymentMethod[]) {
  detailsFetch.mockResolvedValue({ revision: 1, methods, updatedBy: "Ms. Mys", updatedAt: "2026-11-15T00:00:00.000Z" });
  render(
    <PortalQueryProvider actorKey="mys@pmcm.test">
      <BillingSourcesTab
        eventId="evt_1" eventName="Gala" billingSources={[approvedSource]} statements={[]} proposalDocuments={[]} busy={false}
        onCreate={vi.fn()} onApprove={vi.fn()} onGenerate={vi.fn()}
      />
    </PortalQueryProvider>,
  );
}

describe("billing sources and payment details", () => {
  it("warns with a link and will not generate a statement while no payment method is turned on", async () => {
    renderTab([{ ...bpi, enabled: false }]);

    expect((await screen.findByRole("alert")).textContent).toContain("cannot be issued yet");
    expect(screen.getByRole("link", { name: "Add payment details" }).getAttribute("href")).toBe("/dashboard/finance/payment-details");
    const generate = screen.getByRole("button", { name: "Generate statement" }) as HTMLButtonElement;
    expect(generate.disabled).toBe(true);
    expect(generate.title).toContain("Add your payment details first");
  });

  it("lets a statement be generated, with no warning, once a payment method is turned on", async () => {
    renderTab([bpi]);

    const generate = (await screen.findByRole("button", { name: "Generate statement" })) as HTMLButtonElement;
    await vi.waitFor(() => expect(detailsFetch).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(generate.disabled).toBe(false);
  });
});
