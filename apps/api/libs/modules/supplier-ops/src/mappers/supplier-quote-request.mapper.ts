import type { OpsSupplierQuoteRequest } from '@prisma/client';
import { SupplierVerificationStatus } from '@prism/modules/event-core';

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timestamp(value: Date) {
  return value.toISOString();
}

export function mapSupplierQuoteRequest(request: OpsSupplierQuoteRequest) {
  const expanded = request as OpsSupplierQuoteRequest & {
    assignmentStatus?: string;
    assignmentConfirmedAt?: Date | null;
    readinessStatus?: string;
    readinessConfirmedAt?: Date | null;
    readinessNotes?: string;
    eventDayStatus?: string;
    eventDayStatusAt?: Date | null;
    eventDayNotes?: string;
    eventDayVerificationStatus?: string;
    eventDayVerifiedAt?: Date | null;
    eventDayVerifiedBy?: string | null;
    eventDayVerificationNotes?: string;
    statusPhotoFileName?: string | null;
    contractDocumentId?: string | null;
  };
  return {
    id: request.id,
    eventId: request.eventId,
    supplierId: request.supplierId ?? undefined,
    categoryId: request.categoryId ?? undefined,
    supplierName: request.supplierName,
    category: request.category,
    message: request.message,
    dueDate: request.dueDate ? isoDate(request.dueDate) : null,
    accessToken: request.accessToken,
    confidentialBid: request.confidentialBid,
    status: request.status,
    assignmentStatus: expanded.assignmentStatus ?? 'pending_confirmation',
    assignmentConfirmedAt: expanded.assignmentConfirmedAt ? timestamp(expanded.assignmentConfirmedAt) : null,
    readinessStatus: expanded.readinessStatus ?? 'not_requested',
    readinessConfirmedAt: expanded.readinessConfirmedAt ? timestamp(expanded.readinessConfirmedAt) : null,
    readinessNotes: expanded.readinessNotes ?? '',
    eventDayStatus: expanded.eventDayStatus ?? 'not_started',
    eventDayStatusAt: expanded.eventDayStatusAt ? timestamp(expanded.eventDayStatusAt) : null,
    eventDayNotes: expanded.eventDayNotes ?? '',
    eventDayVerificationStatus: expanded.eventDayVerificationStatus ?? SupplierVerificationStatus.SelfReported,
    eventDayVerifiedAt: expanded.eventDayVerifiedAt ? timestamp(expanded.eventDayVerifiedAt) : null,
    eventDayVerifiedBy: expanded.eventDayVerifiedBy ?? null,
    eventDayVerificationNotes: expanded.eventDayVerificationNotes ?? '',
    statusPhotoFileName: expanded.statusPhotoFileName ?? null,
    contractDocumentId: expanded.contractDocumentId ?? null,
    createdAt: timestamp(request.createdAt),
  };
}