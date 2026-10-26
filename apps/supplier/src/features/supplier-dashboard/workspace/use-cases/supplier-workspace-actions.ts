import { supplierWorkspaceRepository } from "../data/supplier-workspace-repository";
import { supplierWorkflowRepository } from "../data/supplier-workflow-repository";
import {
  eventStatusSuccessNotice,
  parseQuoteForm,
  quoteSubmitSuccessNotice,
} from "../model/supplier-workspace-rules";
import type { PrismAuthenticatedSession, PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard, PrismSupplierWorkflowWorkspace } from "@prism/types";
import type { PrismSupplier, QuoteFormState, SupplierWorkspace } from "../model/supplier-workspace-types";

export function loadSupplierDashboardSession(): PrismAuthenticatedSession | null {
  return supplierWorkspaceRepository.readSession();
}

/** Signing out locally is the user's intent; the server token dies at expiry, so a failed logout is not surfaced. */
export async function signOutSupplier(): Promise<void> {
  try {
    await supplierWorkspaceRepository.logout();
  } catch {
    // Ignored on purpose: the local session is cleared below regardless.
  } finally {
    supplierWorkspaceRepository.clearSession();
  }
}

export async function loadSupplierWorkspace(session: PrismAuthenticatedSession): Promise<{
  workspace: SupplierWorkspace;
  readinessBoard: PrismSupplierReadinessBoard | null;
  workflows: PrismSupplierWorkflowWorkspace;
}> {
  const [workspace, readinessBoard, workflows] = await Promise.all([
    supplierWorkspaceRepository.fetchWorkspace(session),
    supplierWorkspaceRepository.fetchReadinessBoard(session).catch(() => null),
    supplierWorkflowRepository.fetch(session),
  ]);
  return { workspace, readinessBoard, workflows };
}

export async function submitOrReviseQuote(input: {
  request: PrismSupplierQuoteRequest;
  form: QuoteFormState;
  existingQuote?: PrismSupplierQuote;
}): Promise<{ notice: string }> {
  const parsed = parseQuoteForm(input.form);
  if ("error" in parsed) {
    throw new Error(parsed.error);
  }
  if (input.existingQuote) {
    await supplierWorkspaceRepository.reviseQuote(input.request.accessToken, parsed);
    return { notice: quoteSubmitSuccessNotice(true) };
  }
  await supplierWorkspaceRepository.submitQuote(input.request.accessToken, parsed);
  return { notice: quoteSubmitSuccessNotice(false) };
}

export async function confirmSupplierAssignment(
  session: PrismAuthenticatedSession,
  request: PrismSupplierQuoteRequest,
): Promise<{ notice: string }> {
  await supplierWorkspaceRepository.confirmAssignment(session, request.id);
  return { notice: "Assignment confirmed." };
}

export async function confirmSupplierReadiness(
  session: PrismAuthenticatedSession,
  request: PrismSupplierQuoteRequest,
  notes: string,
): Promise<{ notice: string }> {
  await supplierWorkspaceRepository.confirmReadiness(session, request.id, notes);
  return { notice: "Readiness confirmed." };
}

export async function saveSupplierContract(
  session: PrismAuthenticatedSession,
  supplier: PrismSupplier,
  request: PrismSupplierQuoteRequest,
  file: File,
): Promise<{ notice: string }> {
  await supplierWorkflowRepository.uploadContract(session, supplier, request, file);
  return { notice: "Contract uploaded for PMCM review." };
}

export async function acknowledgeSupplierSchedule(session: PrismAuthenticatedSession, requestId: string, expectedRevision: number) {
  await supplierWorkflowRepository.acknowledgeSchedule(session, requestId, expectedRevision);
  return { notice: "Schedule acknowledged." };
}

export async function requestSupplierScheduleChange(session: PrismAuthenticatedSession, requestId: string, expectedRevision: number, reason: string) {
  await supplierWorkflowRepository.requestScheduleChange(session, requestId, expectedRevision, reason);
  return { notice: "Schedule change request sent to PMCM." };
}

export async function updateSupplierCreativeProgress(session: PrismAuthenticatedSession, taskId: string, note: string) {
  await supplierWorkflowRepository.updateCreativeProgress(session, taskId, note);
  return { notice: "Progress saved." };
}

export async function submitSupplierCreativeTask(
  session: PrismAuthenticatedSession,
  supplier: PrismSupplier,
  request: PrismSupplierQuoteRequest,
  taskId: string,
  note: string,
  file?: File,
) {
  await supplierWorkflowRepository.submitCreativeTask(session, supplier, request, taskId, { note, storedObjectId: null }, file);
  return { notice: "Deliverable submitted to PMCM." };
}

export async function updateSupplierEventStatus(
  session: PrismAuthenticatedSession,
  request: PrismSupplierQuoteRequest,
  status: string,
  notes: string,
): Promise<{ notice: string }> {
  await supplierWorkspaceRepository.updateEventStatus(
    session,
    request.id,
    status,
    notes,
  );
  return { notice: eventStatusSuccessNotice(status) };
}
