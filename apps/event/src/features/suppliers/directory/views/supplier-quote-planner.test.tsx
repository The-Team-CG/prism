/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PrismSupplierCategory, PrismSupplierQuoteRoundComparison } from "@prism/types";
import { SupplierQuotePlanner } from "./supplier-quote-planner";

const categories: PrismSupplierCategory[] = ["Production", "Catering"].map((name) => ({
  id: name, name, slug: name.toLowerCase(), active: true, sortOrder: 0, reviewDimensions: [],
}));

describe("SupplierQuotePlanner", () => {
  it("discards a comparison that finishes after the user selects another category", async () => {
    let finish: ((result: PrismSupplierQuoteRoundComparison) => void) | undefined;
    const comparison = new Promise<PrismSupplierQuoteRoundComparison>((resolve) => { finish = resolve; });
    render(<SupplierQuotePlanner categories={categories} suppliers={[]} quotes={[]} requests={[{
      id: "request-a", eventId: "event-a", categoryId: "Production", category: "Production", roundId: "round-a", roundNumber: 1,
      supplierName: "Previous category supplier", message: "", accessToken: "", confidentialBid: false, status: "open", createdAt: "2026-10-01",
    }]} busy={false} onRequestQuotes={vi.fn()} onSelectQuote={vi.fn()} onCompareRound={() => comparison} onSetAvailability={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Round 1" }));
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "Catering" } });
    await act(async () => {
      if (!finish) throw new Error("Comparison did not start");
      finish({ id: "round-a", eventId: "event-a", category: "Production", roundNumber: 1, status: "open", bids: [{
        id: "quote-a", supplierName: "Previous category supplier", amount: 1000, inclusions: [], paymentTerms: "", notes: "", outsideAcceptableRange: false, status: "submitted",
      }] });
      await comparison;
    });
    expect(screen.queryByText("Previous category supplier")).toBeNull();
    expect(screen.getAllByRole("combobox")[0]).toHaveProperty("value", "Catering");
  });
});
