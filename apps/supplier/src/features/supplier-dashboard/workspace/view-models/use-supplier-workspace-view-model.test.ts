/** @vitest-environment jsdom */
import { createElement } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortalQueryProvider } from "@prism/portal-query";
import type { PrismAuthenticatedSession } from "@prism/types";
import { supplierWorkflowRepository } from "../data/supplier-workflow-repository";
import { supplierWorkspaceRepository } from "../data/supplier-workspace-repository";
import type { SupplierDashboardSection } from "../model/supplier-workspace-types";
import { useSupplierWorkspaceViewModel } from "./use-supplier-workspace-view-model";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const session = {
  id: "supplier_1",
  name: "Supplier User",
  email: "supplier@example.test",
  role: "supplier",
  accessToken: "verified-supplier-token",
} as PrismAuthenticatedSession;
const request = { id: "req_1", eventId: "evt_1", status: "awarded", createdAt: "2026-10-20T00:00:00.000Z" };
const workspace = { supplier: { id: "sup_1", name: "Supplier Co" }, quoteRequests: [request], supplierQuotes: [] };

type ViewModel = ReturnType<typeof useSupplierWorkspaceViewModel>;

// A section page, keyed by section the way route navigation remounts it, inside the one dashboard-layout cache.
function renderSection(section: SupplierDashboardSection, latest: { current: ViewModel | null }) {
  function SectionPage() {
    latest.current = useSupplierWorkspaceViewModel(section);
    return null;
  }
  return createElement(PortalQueryProvider, { actorKey: session.email, children: createElement(SectionPage, { key: section }) });
}

describe("useSupplierWorkspaceViewModel", () => {
  it("reuses one workspace read across sections and refreshes it after a command", async () => {
    vi.spyOn(supplierWorkspaceRepository, "readSession").mockReturnValue(session);
    const fetchWorkspace = vi.spyOn(supplierWorkspaceRepository, "fetchWorkspace").mockResolvedValue(workspace as never);
    vi.spyOn(supplierWorkspaceRepository, "fetchReadinessBoard").mockRejectedValue(new Error("no board"));
    vi.spyOn(supplierWorkflowRepository, "fetch").mockResolvedValue({ requests: [] } as never);
    const confirm = vi.spyOn(supplierWorkspaceRepository, "confirmAssignment").mockResolvedValue(undefined as never);

    const result: { current: ViewModel | null } = { current: null };
    const { rerender } = render(renderSection("dashboard", result));
    await waitFor(() => expect(result.current?.status).toBe("success"));
    // A supplier without a readiness board still gets the workspace.
    expect(result.current?.readinessBoard).toBeNull();

    rerender(renderSection("quotations", result));
    expect(result.current?.status).toBe("success");
    expect(result.current?.workspace).toEqual(workspace);
    expect(fetchWorkspace).toHaveBeenCalledTimes(1);

    await act(async () => result.current?.confirmAssignment(request as never));

    expect(confirm).toHaveBeenCalledWith(session, "req_1");
    expect(fetchWorkspace).toHaveBeenCalledTimes(2);
    expect(result.current?.notice).toBe("Assignment confirmed.");
  });
});
