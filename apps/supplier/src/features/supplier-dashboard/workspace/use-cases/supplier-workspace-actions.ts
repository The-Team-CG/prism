import { supplierWorkspaceRepository } from "../data/supplier-workspace-repository";
import { supplierWorkflowRepository } from "../data/supplier-workflow-repository";
import {
  eventStatusSuccessNotice,
  parseQuoteForm,
  quoteSubmitSuccessNotice,
} from "../model/supplier-workspace-rules";
import type { PrismAuthenticatedSession, PrismFileRequirementsMatrix, PrismSupplierQuote, PrismSupplierQuoteRequest } from "@prism/types";
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

export async function loadSupplierFileRequirements(
  session: PrismAuthenticatedSession,
  eventIds: string[],
): Promise<PrismFileRequirementsMatrix[]> {
  const matrices: PrismFileRequirementsMatrix[] = [];
  const uniqueEventIds = [...new Set(eventIds)];
  for (let offset = 0; offset < uniqueEventIds.length; offset += 10) {
    const batch = await Promise.all(uniqueEventIds.slice(offset, offset + 10).map((eventId) =>
      supplierWorkspaceRepository.fetchFileRequirements(eventId, session),
    ));
    matrices.push(...batch);
  }
  return matrices;
}
export function uploadSupplierFileRequirement(session: PrismAuthenticatedSession, supplier: PrismSupplier, eventId: string, key: string, file: File) {
  return supplierWorkflowRepository.uploadRequirement(session, supplier, eventId, key, file);
}

/** One of this supplier's stored files, for a preview in the page. */
export function loadSupplierStoredFile(session: PrismAuthenticatedSession, objectId: string) {
  return supplierWorkflowRepository.download(session, objectId);
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
  contractTotal: number,
): Promise<{ notice: string }> {
  await supplierWorkflowRepository.uploadContract(session, supplier, request, file, contractTotal);
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
  supplier: PrismSupplier,
  request: PrismSupplierQuoteRequest,
  status: string,
  notes: string,
  photo?: File,
): Promise<{ notice: string }> {
  const storedObjectId = photo ? await supplierWorkflowRepository.uploadStatusPhoto(session, supplier, request, photo) : undefined;
  await supplierWorkflowRepository.updateEventStatus(
    session,
    request.id,
    status,
    notes,
    storedObjectId,
  );
  return { notice: eventStatusSuccessNotice(status) };
}
