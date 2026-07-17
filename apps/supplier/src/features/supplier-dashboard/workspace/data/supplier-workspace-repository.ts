import {
  PRISM_SESSION_STORAGE_KEYS,
  clearPrismSession,
  readPrismSession,
} from "@prism/types";
import { prismApi, type SubmitQuoteInput, type SupplierSession, type SupplierWorkspace } from "@/lib/prism-api";
import type { PrismSupplierReadinessBoard } from "../model/supplier-workspace-types";

const SESSION_KEY = PRISM_SESSION_STORAGE_KEYS.supplier;

export const supplierWorkspaceRepository = {
  readSession(): SupplierSession | null {
    return readPrismSession<SupplierSession>(SESSION_KEY);
  },

  clearSession(): void {
    clearPrismSession(SESSION_KEY);
  },

  fetchWorkspace(session: SupplierSession): Promise<SupplierWorkspace> {
    return prismApi.supplierWorkspace(session);
  },

  fetchReadinessBoard(session: SupplierSession): Promise<PrismSupplierReadinessBoard> {
    return prismApi.supplierReadinessBoard(session);
  },

  submitQuote(token: string, input: SubmitQuoteInput) {
    return prismApi.submitQuote(token, input);
  },

  reviseQuote(token: string, input: SubmitQuoteInput) {
    return prismApi.reviseQuote(token, input);
  },

  confirmAssignment(session: SupplierSession, requestId: string) {
    return prismApi.confirmAssignment(session, requestId);
  },

  confirmReadiness(session: SupplierSession, requestId: string, notes: string) {
    return prismApi.confirmReadiness(session, requestId, notes);
  },

  uploadContract(session: SupplierSession, requestId: string, fileName: string) {
    return prismApi.uploadContract(session, requestId, fileName);
  },

  updateEventStatus(
    session: SupplierSession,
    requestId: string,
    status: string,
    notes: string,
  ) {
    return prismApi.updateEventStatus(session, requestId, status, notes);
  },
};
