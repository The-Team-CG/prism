/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupplierFileReadiness } from "./supplier-file-readiness";

const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../view-models/use-file-requirements-matrix-view-model", () => ({ useFileRequirementsMatrixViewModel: load }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("supplier file readiness", () => {
  it("shows each assigned supplier's file status and replacement requests", () => {
    load.mockReturnValue({ status: "success", matrix: { items: [{ key: "insurance", label: "Insurance", supplierFulfilments: [
      { supplierId: "a", supplierName: "Atlas", status: "missing", overdue: true, reviewReason: "Expired" },
      { supplierId: "b", supplierName: "Bright", status: "approved", overdue: false },
    ] }] } });
    render(<SupplierFileReadiness eventId="event" />);
    expect(screen.getByText("Atlas · Insurance: Replacement requested · Overdue")).toBeTruthy();
    expect(screen.getByText("Bright · Insurance: approved")).toBeTruthy();
  });

  it("does not report an empty assignment when the matrix cannot be loaded", () => {
    load.mockReturnValue({ status: "error", matrix: null });
    render(<SupplierFileReadiness eventId="event" />);
    expect(screen.getByRole("alert").textContent).toContain("Unable to load");
    expect(screen.queryByText("No supplier file requirements are assigned.")).toBeNull();
  });
});
