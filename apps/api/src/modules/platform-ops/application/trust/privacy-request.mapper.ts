import { PRISM_PRIVACY_REQUEST_SLA_DAYS, type PrismPrivacyRequest } from '@prism/types';
import { PrivacyRequestStatus } from '@prism/kernel/event-core';

export type OpsPrivacyRequestRecord = {
  id: string;
  eventId?: string | null;
  subjectType: string;
  subjectEmail: string;
  subjectName: string;
  requestType: string;
  status: string;
  requestNotes: string;
  reviewReason: string;
  executionNotes?: string;
  createdBy: string;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  executedBy?: string | null;
  executedAt?: Date | null;
  dueAt: Date;
  assignedTo?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Statuses that still need PMCM action and can therefore breach the SLA. */
export const OPEN_PRIVACY_REQUEST_STATUSES = [PrivacyRequestStatus.Submitted, PrivacyRequestStatus.Approved] as const;

/** SLA deadline for a request submitted at `submittedAt`. */
export function privacyRequestDueAt(submittedAt: Date): Date {
  return new Date(submittedAt.getTime() + PRISM_PRIVACY_REQUEST_SLA_DAYS * DAY_MS);
}

/** Executed and rejected requests are closed and never overdue, however late they were closed. */
export function isPrivacyRequestOverdue(request: Pick<OpsPrivacyRequestRecord, 'status' | 'dueAt'>, now: Date): boolean {
  return (OPEN_PRIVACY_REQUEST_STATUSES as readonly string[]).includes(request.status) && request.dueAt.getTime() < now.getTime();
}

function timestamp(value?: Date | null) {
  return value ? value.toISOString() : null;
}

export function mapPrivacyRequest(request: OpsPrivacyRequestRecord, now: Date = new Date()): PrismPrivacyRequest {
  return {
    id: request.id,
    eventId: request.eventId ?? null,
    subjectType: request.subjectType,
    subjectEmail: request.subjectEmail,
    subjectName: request.subjectName,
    requestType: request.requestType,
    status: request.status,
    requestNotes: request.requestNotes,
    reviewReason: request.reviewReason,
    executionNotes: request.executionNotes ?? '',
    createdBy: request.createdBy,
    reviewedBy: request.reviewedBy ?? null,
    reviewedAt: timestamp(request.reviewedAt),
    executedBy: request.executedBy ?? null,
    executedAt: timestamp(request.executedAt),
    dueAt: request.dueAt.toISOString(),
    overdue: isPrivacyRequestOverdue(request, now),
    assignedTo: request.assignedTo ?? null,
    createdAt: timestamp(request.createdAt) ?? '',
    updatedAt: timestamp(request.updatedAt) ?? '',
  };
}
