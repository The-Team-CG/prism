import {
  PRISM_SESSION_STORAGE_KEYS,
  clearPrismSession,
  readPrismSession,
  type PrismAuthenticatedSession,
  type PrismFileRequirementsMatrix,
  type SubmitSupplierQuoteInput,
} from "@prism/types";
import { prismApi } from "@/lib/prism-api";
import type { PrismSupplierReadinessBoard, SupplierWorkspace } from "../model/supplier-workspace-types";

const SESSION_KEY = PRISM_SESSION_STORAGE_KEYS.supplier;

export const supplierWorkspaceRepository = {
  readSession(): PrismAuthenticatedSession | null {
    return readPrismSession<PrismAuthenticatedSession>(SESSION_KEY);
  },

  clearSession(): void {
    clearPrismSession(SESSION_KEY);
  },

  logout(): Promise<void> {
    return prismApi.logout();
  },

  fetchWorkspace(session: PrismAuthenticatedSession): Promise<SupplierWorkspace> {
    return prismApi.supplierWorkspace(session);
  },

  fetchReadinessBoard(session: PrismAuthenticatedSession): Promise<PrismSupplierReadinessBoard> {
    return prismApi.supplierReadinessBoard(session);
  },

  fetchFileRequirements(
    eventId: string,
    session: PrismAuthenticatedSession,
  ): Promise<PrismFileRequirementsMatrix> {
    return prismApi.fileRequirements(eventId, session);
  },

  submitQuote(token: string, input: SubmitSupplierQuoteInput) {
    return prismApi.submitQuote(token, input);
  },

  reviseQuote(token: string, input: SubmitSupplierQuoteInput) {
    return prismApi.reviseQuote(token, input);
  },

  confirmAssignment(session: PrismAuthenticatedSession, requestId: string) {
    return prismApi.confirmAssignment(session, requestId);
  },

  confirmReadiness(session: PrismAuthenticatedSession, requestId: string, notes: string) {
    return prismApi.confirmReadiness(session, requestId, notes);
  },

  updateEventStatus(
    session: PrismAuthenticatedSession,
    requestId: string,
    status: string,
    notes: string,
  ) {
    return prismApi.updateEventStatus(session, requestId, status, notes);
  },
};
