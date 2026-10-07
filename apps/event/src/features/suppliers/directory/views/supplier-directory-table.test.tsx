/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SupplierDirectoryTable } from "./supplier-directory-table";

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
  certifications: { rejected: 0, expired: 1, submitted: 2, verified: 3, unknown: 0, attention: "expired" },
};
const directory = { items: [row], totalCount: 61, page: 0, pageSize: 25, hasNextPage: true, query, asOf: "2026-10-07T00:00:00.000Z" } as never;

describe("SupplierDirectoryTable", () => {
  it("renders the annotated table columns, review count and real page controls", () => {
    render(<SupplierDirectoryTable directory={directory} categories={[]} query={query} searchDraft="" loading={false} error={null} view="all" onSearch={vi.fn()} onQueryChange={vi.fn()} onSelectSupplier={vi.fn()} onRefresh={vi.fn()} onRetry={vi.fn()} />);

    for (const name of ["Supplier", "Category", "Tier", "Contact", "Rating", "Certifications", "Last review"]) expect(screen.getByRole("columnheader", { name })).toBeTruthy();
    expect(screen.getByText("Harborline Production")).toBeTruthy();
    expect(screen.getByText("4.6 / 5 (128)")).toBeTruthy();
    expect(screen.getByText("Expired · 6")).toBeTruthy();
    expect(screen.getByText("61 suppliers")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(false);
  });

  it("opens a supplier from its keyboard reachable name button and changes pages", () => {
    const onSelectSupplier = vi.fn();
    const onQueryChange = vi.fn();
    render(<SupplierDirectoryTable directory={directory} categories={[]} query={query} searchDraft="" loading={false} error={null} view="all" onSearch={vi.fn()} onQueryChange={onQueryChange} onSelectSupplier={onSelectSupplier} onRefresh={vi.fn()} onRetry={vi.fn()} />);

    const supplierButton = screen.getByRole("button", { name: "Harborline Production" });
    supplierButton.focus();
    fireEvent.click(supplierButton);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(onSelectSupplier).toHaveBeenCalledWith("supplier-1", supplierButton);
    expect(onQueryChange).toHaveBeenCalledWith({ page: 1 });
  });
});
