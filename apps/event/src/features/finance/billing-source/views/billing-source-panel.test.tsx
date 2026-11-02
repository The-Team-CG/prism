/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismBillingStatement } from "@prism/types";
import { BillingSourcePanel } from "./billing-source-panel";

afterEach(cleanup);

function renderPanel(onCreate: (input: unknown) => Promise<boolean>) {
  render(
    <BillingSourcePanel
      eventName="Gala"
      billingSources={[]}
      proposalDocuments={[]}
      busy={false}
      onCreate={onCreate}
      onApprove={vi.fn()}
      onGenerate={vi.fn()}
    />,
  );
  return {
    amount: screen.getByLabelText("Amount (PHP)") as HTMLInputElement,
    create: screen.getByRole("button", { name: "Create billing source" }),
  };
}

describe("BillingSourcePanel", () => {
  it("blocks amounts the shared contract rejects and says why", () => {
    const onCreate = vi.fn();
    const { amount, create } = renderPanel(onCreate);

    fireEvent.change(amount, { target: { value: "125000.50" } });

    expect((create as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("whole peso amount");
  });

  it("submits the parsed contract and keeps the entered amount when creation fails", async () => {
    const onCreate = vi.fn(async () => false);
    const { amount, create } = renderPanel(onCreate);

    fireEvent.change(amount, { target: { value: "100000" } });
    fireEvent.click(create);

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      sourceLabel: "Gala approved proposal",
      lineItems: [{ label: "Approved event package", amount: 100000 }],
    })));
    expect(amount.value).toBe("100000");
  });

  it("tells PMCM a statement was issued without a source instead of asking them to create one first", () => {
    const issued: PrismBillingStatement = {
      id: "bill_1", eventId: "evt_1", number: "BS-2026-0001", clientName: "Ana", clientContact: "ana@example.test",
      eventName: "Gala", lineItems: [], paymentSchedule: [], paymentMethods: [], totalAmount: 520000,
      pdfUrl: "", status: "issued", generatedAt: "2026-05-01T00:00:00.000Z",
    };
    render(
      <BillingSourcePanel
        eventName="Gala"
        billingSources={[]}
        statements={[issued]}
        proposalDocuments={[]}
        busy={false}
        onCreate={vi.fn()}
        onApprove={vi.fn()}
        onGenerate={vi.fn()}
      />,
    );

    const sources = screen.getByRole("list", { name: "Billing sources" }).textContent ?? "";
    expect(sources).toContain("BS-2026-0001 was issued without a linked billing source");
    expect(sources).not.toContain("Create one from the issued proposal");
  });
});
