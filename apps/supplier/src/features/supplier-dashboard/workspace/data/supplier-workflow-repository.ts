import { getStorageObjectDownload, uploadStorageObject } from '@prism/api-client';
import { eventOpsClient } from '@/lib/prism-api';
import type {
  PrismAuthenticatedSession,
  PrismSupplierQuoteRequest,
  PrismSupplierWorkflowWorkspace,
  SubmitSupplierCreativeTaskInput,
} from '@prism/types';
import type { PrismSupplier } from '../model/supplier-workspace-types';

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
    return eventOpsClient.supplierWorkflows.detail();
  },

  async uploadContract(session: PrismAuthenticatedSession, supplier: PrismSupplier, request: PrismSupplierQuoteRequest, file: File, contractTotal: number) {
    const key = `contract:${supplier.id}:${request.id}:${await contentFingerprint(file)}`;
    const currentAttemptId = attemptId(key);
    const stored = await uploadStorageObject(file, {
      eventId: request.eventId,
      ownerRecordType: 'supplier',
      ownerRecordId: supplier.id,
      logicalTarget: `supplier-contract:${request.id}:${currentAttemptId}`,
      usage: 'supplier_document',
    }, { authToken: session.accessToken });
    const result = await eventOpsClient.supplierWorkflows.bindContract(request.id, {
      storedObjectId: stored.id,
      checksumSha256: stored.checksumSha256,
      contractTotal,
    });
    uploadAttempts.delete(key);
    return result;
  },

  async uploadRequirement(session: PrismAuthenticatedSession, supplier: PrismSupplier, eventId: string, requirementKey: string, file: File) {
    const key = `requirement:${supplier.id}:${eventId}:${requirementKey}:${await contentFingerprint(file)}`;
    const currentAttemptId = attemptId(key);
    const stored = await uploadStorageObject(file, {
      eventId,
      ownerRecordType: 'supplier',
      ownerRecordId: supplier.id,
      logicalTarget: `supplier-requirement:${requirementKey}:${currentAttemptId}`,
      usage: 'supplier_document',
    }, { authToken: session.accessToken });
    const result = await eventOpsClient.events.bindFileRequirementUpload(eventId, requirementKey, { objectId: stored.id });
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
    const result = await eventOpsClient.supplierWorkflows.submitCreativeTask(taskId, payload);
    uploadAttempts.delete(key);
    return result;
  },

  /** Uploads an event-day status photo and returns the stored object the status update must reference. */
  async uploadStatusPhoto(session: PrismAuthenticatedSession, supplier: PrismSupplier, request: PrismSupplierQuoteRequest, file: File) {
    const key = `status:${supplier.id}:${request.id}:${await contentFingerprint(file)}`;
    const currentAttemptId = attemptId(key);
    const stored = await uploadStorageObject(file, {
      eventId: request.eventId,
      ownerRecordType: 'supplier',
      ownerRecordId: supplier.id,
      logicalTarget: `supplier-status:${request.id}:${currentAttemptId}`,
      usage: 'supplier_document',
    }, { authToken: session.accessToken });
    uploadAttempts.delete(key);
    return stored.id;
  },

  /** Event-day status update; the actor is derived from the bearer token, as on the other workflow writes. */
  updateEventStatus(session: PrismAuthenticatedSession, requestId: string, status: string, notes: string, storedObjectId?: string) {
    return eventOpsClient.supplierWorkspace.updateEventStatus(
      requestId,
      { status: status as "arrived" | "set_up_ready" | "done_leaving", notes, ...(storedObjectId ? { storedObjectId } : {}) },
      { actorRole: "supplier", actorName: session.name, actorEmail: session.email },
    );
  },

  acknowledgeSchedule(session: PrismAuthenticatedSession, requestId: string, expectedRevision: number) {
    return eventOpsClient.supplierWorkflows.acknowledgeSchedule(requestId, { expectedRevision });
  },

  requestScheduleChange(session: PrismAuthenticatedSession, requestId: string, expectedRevision: number, reason: string) {
    return eventOpsClient.supplierWorkflows.requestScheduleChange(requestId, { expectedRevision, reason });
  },

  updateCreativeProgress(session: PrismAuthenticatedSession, taskId: string, note: string) {
    return eventOpsClient.supplierWorkflows.updateCreativeProgress(taskId, { note });
  },

  download(session: PrismAuthenticatedSession, objectId: string) {
    return getStorageObjectDownload(objectId, { authToken: session.accessToken });
  },
};
