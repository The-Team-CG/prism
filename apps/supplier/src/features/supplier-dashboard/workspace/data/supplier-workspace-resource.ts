import { defineResource } from "@prism/portal-query";
import type { PrismAuthenticatedSession, PrismSupplierReadinessBoard, PrismSupplierWorkflowWorkspace } from "@prism/types";
import type { SupplierWorkspace } from "../model/supplier-workspace-types";
import { supplierWorkflowRepository } from "./supplier-workflow-repository";
import { supplierWorkspaceRepository } from "./supplier-workspace-repository";

export type SupplierWorkspaceBundle = {
  workspace: SupplierWorkspace;
  readinessBoard: PrismSupplierReadinessBoard | null;
  workflows: PrismSupplierWorkflowWorkspace;
};

/**
 * Everything the supplier dashboard sections show, read once and shared by every section, so moving between
 * Bookings, Quotes and the rest reuses it instead of reloading. The readiness board is optional for suppliers
 * without one.
 */
export const supplierWorkspaceResource = defineResource({
  name: "supplier.workspace",
  fetch: async (session: PrismAuthenticatedSession): Promise<SupplierWorkspaceBundle> => {
    const [workspace, readinessBoard, workflows] = await Promise.all([
      supplierWorkspaceRepository.fetchWorkspace(session),
      supplierWorkspaceRepository.fetchReadinessBoard(session).catch(() => null),
      supplierWorkflowRepository.fetch(session),
    ]);
    return { workspace, readinessBoard, workflows };
  },
});
