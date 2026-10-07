/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupplierDetailDrawer } from "./supplier-detail-drawer";

const onClose = vi.fn();
const noOp = vi.fn();

beforeEach(() => {
  onClose.mockReset();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open"); } });
});

function renderDrawer() {
  return render(<SupplierDetailDrawer
    supplierId="supplier-1"
    profile={null}
    profileLoading={false}
    profileError="Supplier not found."
    categories={[]}
    engagements={null}
    engagementsLoading={false}
    engagementsError={null}
    reviews={null}
    reviewsLoading={false}
    certifications={null}
    certificationsLoading={false}
    records={null}
    recordsLoading={false}
    recordsError={null}
    profilePeriod="all"
    recordsPeriod="30d"
    engagementPage={0}
    actionSaving={false}
    actionResult={null}
    onClose={onClose}
    onRetry={noOp}
    onOpenEvent={noOp}
    onProfilePeriodChange={noOp}
    onRecordsPeriodChange={noOp}
    onEngagementPageChange={noOp}
    onSubmitAction={vi.fn(async () => ({ saved: true as const, refreshFailed: false }))}
  />);
}

describe("SupplierDetailDrawer", () => {
  it("opens an accessible modal drawer and keeps a missing supplier closable", () => {
    renderDrawer();
    const dialog = screen.getByRole("dialog", { name: "Supplier" });

    expect(dialog.hasAttribute("open")).toBe(true);
    expect(screen.getByText("Supplier not found")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close supplier details" })).toBeTruthy();
  });

  it("closes through Escape and the explicit close control", () => {
    const { unmount } = renderDrawer();
    const dialog = screen.getByRole("dialog", { name: "Supplier" });
    const cancel = new Event("cancel", { bubbles: false, cancelable: true });
    dialog.dispatchEvent(cancel);

    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Close supplier details" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
