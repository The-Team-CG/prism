import { createEventOpsClient, getStorageObjectDownload, uploadStorageObject } from '@prism/api-client';
import type {
  PrismAuthenticatedSession,
  PrismSupplierQuoteRequest,
  PrismSupplierWorkflowWorkspace,
  SubmitSupplierCreativeTaskInput,
} from '@prism/types';
import type { PrismSupplier } from '../model/supplier-workspace-types';

function client(session: PrismAuthenticatedSession) {
  return createEventOpsClient({ getAuthToken: () => session.accessToken });
}

const uploadAttempts = new Map<string, string>();

async function contentFingerprint(file?: File): Promise<string> {
  if (!file) return 'text-only';
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function attemptId(key: string): string {
  const existing = uploadAttempts.get(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  uploadAttempts.set(key, created);
  return created;
}

export const supplierWorkflowRepository = {
  fetch(session: PrismAuthenticatedSession): Promise<PrismSupplierWorkflowWorkspace> {
    return client(session).supplierWorkflows.detail();
  },

  async uploadContract(session: PrismAuthenticatedSession, supplier: PrismSupplier, request: PrismSupplierQuoteRequest, file: File) {
    const key = `contract:${supplier.id}:${request.id}:${await contentFingerprint(file)}`;
    const currentAttemptId = attemptId(key);
    const stored = await uploadStorageObject(file, {
      eventId: request.eventId,
      ownerRecordType: 'supplier',
      ownerRecordId: supplier.id,
      logicalTarget: `supplier-contract:${request.id}:${currentAttemptId}`,
      usage: 'supplier_document',
    }, { authToken: session.accessToken });
    const result = await client(session).supplierWorkflows.bindContract(request.id, {
      storedObjectId: stored.id,
      checksumSha256: stored.checksumSha256,
    });
    uploadAttempts.delete(key);
    return result;
  },

  async submitCreativeTask(
    session: PrismAuthenticatedSession,
    supplier: PrismSupplier,
    request: PrismSupplierQuoteRequest,
    taskId: string,
    input: SubmitSupplierCreativeTaskInput,
    file?: File,
  ) {
    const payload = { ...input };
    const key = `creative:${supplier.id}:${taskId}:${await contentFingerprint(file)}:${input.note.trim()}`;
    const currentAttemptId = attemptId(key);
    if (file) {
      const stored = await uploadStorageObject(file, {
        eventId: request.eventId,
        ownerRecordType: 'supplier',
        ownerRecordId: supplier.id,
        logicalTarget: `supplier-creative:${request.id}:${currentAttemptId}`,
        usage: 'supplier_document',
      }, { authToken: session.accessToken });
      payload.storedObjectId = stored.id;
    }
    const result = await client(session).supplierWorkflows.submitCreativeTask(taskId, payload);
    uploadAttempts.delete(key);
    return result;
  },

  acknowledgeSchedule(session: PrismAuthenticatedSession, requestId: string, expectedRevision: number) {
    return client(session).supplierWorkflows.acknowledgeSchedule(requestId, { expectedRevision });
  },

  requestScheduleChange(session: PrismAuthenticatedSession, requestId: string, expectedRevision: number, reason: string) {
    return client(session).supplierWorkflows.requestScheduleChange(requestId, { expectedRevision, reason });
  },

  updateCreativeProgress(session: PrismAuthenticatedSession, taskId: string, note: string) {
    return client(session).supplierWorkflows.updateCreativeProgress(taskId, { note });
  },

  download(session: PrismAuthenticatedSession, objectId: string) {
    return getStorageObjectDownload(objectId, { authToken: session.accessToken });
  },
};
