import { supplierWorkspaceRepository } from "../data/supplier-workspace-repository";
import {
  eventStatusSuccessNotice,
  parseQuoteForm,
  quoteSubmitSuccessNotice,
} from "../model/supplier-workspace-rules";
import type { PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard, QuoteFormState, SupplierSession, SupplierWorkspace } from "../model/supplier-workspace-types";

export function loadSupplierDashboardSession(): SupplierSession | null {
  return supplierWorkspaceRepository.readSession();
}

export function signOutSupplier(): void {
  supplierWorkspaceRepository.clearSession();
}

export async function loadSupplierWorkspace(session: SupplierSession): Promise<{
  workspace: SupplierWorkspace;
  readinessBoard: PrismSupplierReadinessBoard | null;
}> {
  const [workspace, readinessBoard] = await Promise.all([
    supplierWorkspaceRepository.fetchWorkspace(session),
    supplierWorkspaceRepository.fetchReadinessBoard(session).catch(() => null),
  ]);
  return { workspace, readinessBoard };
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
  session: SupplierSession,
  request: PrismSupplierQuoteRequest,
): Promise<{ notice: string }> {
  await supplierWorkspaceRepository.confirmAssignment(session, request.id);
  return { notice: "Assignment confirmed." };
}

export async function confirmSupplierReadiness(
  session: SupplierSession,
  request: PrismSupplierQuoteRequest,
  notes: string,
): Promise<{ notice: string }> {
  await supplierWorkspaceRepository.confirmReadiness(session, request.id, notes);
  return { notice: "Readiness confirmed." };
}

export async function saveSupplierContract(
  session: SupplierSession,
  request: PrismSupplierQuoteRequest,
  fileName: string,
): Promise<{ notice: string }> {
  await supplierWorkspaceRepository.uploadContract(session, request.id, fileName);
  return { notice: "Contract metadata saved." };
}

export async function updateSupplierEventStatus(
  session: SupplierSession,
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
