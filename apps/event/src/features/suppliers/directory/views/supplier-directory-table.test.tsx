/** @vitest-environment jsdom */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SupplierDirectoryCards, supplierGaps } from "./supplier-directory-table";

const query = { q: "", rating: "all", sort: "name", direction: "asc", page: 0, pageSize: 25 } as const;
const row = {
  id: "supplier-1",
  name: "Harborline Production",
  categoryId: "category-1",
  categoryName: "Production",
  categorySlug: "production",
  tier: "tier_1",
  bniMember: true,
  contactName: "Mina Santos",
  email: "mina@example.test",
  phone: "+63 900 000 0000",
  rating: { average: 4.6, count: 128 },
  lastReviewedAt: "2026-10-01T00:00:00.000Z",
  certifications: { rejected: 0, expired: 1, submitted: 2, verified: 3, unknown: 0, attention: "expired" as const },
  bookedEvents: 31,
};
const directory = { items: [row], totalCount: 61, page: 0, pageSize: 25, hasNextPage: true, query, asOf: "2026-10-07T00:00:00.000Z" } as never;
const categories = [{ id: "category-1", name: "Production" }, { id: "category-2", name: "Catering" }] as never;

const cards = (props: Partial<Parameters<typeof SupplierDirectoryCards>[0]> = {}) => (
  <SupplierDirectoryCards directory={directory} categories={categories} query={query} searchDraft="" loading={false} error={null} view="all" onSearch={vi.fn()} onQueryChange={vi.fn()} onSelectSupplier={vi.fn()} onRefresh={vi.fn()} onRetry={vi.fn()} {...props} />
);

describe("SupplierDirectoryCards", () => {
  it("shows each supplier's category and tier, bookings, rating and what PMCM is missing, with real page controls", () => {
    render(cards());

    const card = screen.getByTestId("supplier-card");
    expect(within(card).getByText("Production · Tier 1")).toBeTruthy();
    expect(card.textContent).toContain("Booked on 31 events");
    expect(card.textContent).toContain("4.6from 128 reviews");
    expect(within(card).getByText("1 certificate expired")).toBeTruthy();
    expect(screen.getByText("61 suppliers")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(false);
  });

  it("names the supplier's next confirmed booking when there is one", () => {
    render(cards({ nextBookings: new Map([["supplier-1", { supplierId: "supplier-1", eventId: "evt-1", eventName: "Founders gala", eventDate: "2026-12-05" }]]) }));

    expect(screen.getByTestId("supplier-card").textContent).toContain("Next: Dec 5, 2026 · Founders gala");
  });

  it("opens a supplier from its name and changes pages", () => {
    const onSelectSupplier = vi.fn();
    const onQueryChange = vi.fn();
    render(cards({ onSelectSupplier, onQueryChange }));

    const supplierButton = screen.getByRole("button", { name: "Harborline Production" });
    fireEvent.click(supplierButton);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(onSelectSupplier).toHaveBeenCalledWith("supplier-1", supplierButton);
    expect(onQueryChange).toHaveBeenCalledWith({ page: 1 });
  });

  it("filters by category from a chip and by tier from the select", () => {
    const onQueryChange = vi.fn();
    render(cards({ onQueryChange }));

    fireEvent.click(within(screen.getByRole("group", { name: "Category" })).getByRole("button", { name: "Catering" }));
    expect(onQueryChange).toHaveBeenLastCalledWith({ categoryId: "category-2", page: 0 });

    fireEvent.keyDown(screen.getByRole("combobox", { name: "Tier" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "Tier 1" }));
    expect(onQueryChange).toHaveBeenLastCalledWith({ tier: "tier_1", page: 0 });
  });

  it("names contact gaps and certificates needing attention", () => {
    expect(supplierGaps({ ...row, contactName: "", email: "", phone: "", certifications: { ...row.certifications, attention: "none" } })).toEqual(["No contact person", "No email or phone"]);
    expect(supplierGaps(row)).toEqual(["1 certificate expired"]);
  });
});
