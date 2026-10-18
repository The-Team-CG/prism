import type { OpsSupplierQuote, OpsSupplierQuoteRequest, OpsSupplierSchedule } from '@prisma/client';
import { SupplierVerificationStatus } from '@prism/kernel/event-core';
import type { PrismSupplierQuoteRequest, PrismSupplierSchedule } from '@prism/types';
import type { QuoteRequestTokenDetail } from './commercial-workflow.service';

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timestamp(value: Date) {
  return value.toISOString();
}

export function mapSupplierQuoteRequest(request: OpsSupplierQuoteRequest & { contractVersions?: Array<{ reviewStatus: string }> }) {
  const reviewStatus = request.contractVersions?.[0]?.reviewStatus;
  const contractReviewStatus: NonNullable<PrismSupplierQuoteRequest['contractReviewStatus']> = reviewStatus === 'submitted' || reviewStatus === 'accepted' || reviewStatus === 'changes_requested'
    ? reviewStatus : 'missing';
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
    assignmentStatus: request.assignmentStatus ?? 'pending_confirmation',
    assignmentConfirmedAt: request.assignmentConfirmedAt ? timestamp(request.assignmentConfirmedAt) : null,
    readinessStatus: request.readinessStatus ?? 'not_requested',
    readinessConfirmedAt: request.readinessConfirmedAt ? timestamp(request.readinessConfirmedAt) : null,
    readinessNotes: request.readinessNotes ?? '',
    eventDayStatus: request.eventDayStatus ?? 'not_started',
    eventDayStatusAt: request.eventDayStatusAt ? timestamp(request.eventDayStatusAt) : null,
    eventDayNotes: request.eventDayNotes ?? '',
    eventDayVerificationStatus: request.eventDayVerificationStatus ?? SupplierVerificationStatus.SelfReported,
    eventDayVerifiedAt: request.eventDayVerifiedAt ? timestamp(request.eventDayVerifiedAt) : null,
    eventDayVerifiedBy: request.eventDayVerifiedBy ?? null,
    eventDayVerificationNotes: request.eventDayVerificationNotes ?? '',
    statusPhotoFileName: request.statusPhotoFileName ?? null,
    contractDocumentId: request.contractDocumentId ?? null,
    contractReviewStatus: request.contractVersions ? contractReviewStatus : undefined,
    createdAt: timestamp(request.createdAt),
  };
}

export function mapSupplierQuote(quote: OpsSupplierQuote) {
  const inclusions = Array.isArray(quote.inclusions)
    ? quote.inclusions.filter((value): value is string => typeof value === 'string')
    : [];
  return {
    id: quote.id,
    eventId: quote.eventId,
    requestId: quote.requestId ?? undefined,
    supplierId: quote.supplierId ?? undefined,
    categoryId: quote.categoryId ?? undefined,
    supplierName: quote.supplierName,
    category: quote.category,
    amount: quote.amount,
    inclusions,
    paymentTerms: quote.paymentTerms,
    notes: quote.notes,
    acceptableMin: quote.acceptableMin ?? null,
    acceptableMax: quote.acceptableMax ?? null,
    outsideAcceptableRange: quote.outsideAcceptableRange,
    status: quote.status,
    revisionNumber: quote.revisionNumber ?? 1,
    revisedAt: quote.revisedAt ? timestamp(quote.revisedAt) : null,
    selectedAt: quote.selectedAt ? timestamp(quote.selectedAt) : null,
    lockedAt: quote.lockedAt ? timestamp(quote.lockedAt) : null,
    createdAt: timestamp(quote.createdAt),
    updatedAt: timestamp(quote.updatedAt),
  };
}

export function mapSupplierSchedule(schedule: OpsSupplierSchedule, supplierName: string): PrismSupplierSchedule {
  return {
    id: schedule.id,
    eventId: schedule.eventId,
    requestId: schedule.requestId,
    supplierName,
    ingressAt: timestamp(schedule.ingressAt),
    egressAt: timestamp(schedule.egressAt),
    location: schedule.location,
    notes: schedule.notes,
    status: schedule.status,
    createdAt: timestamp(schedule.createdAt),
    updatedAt: timestamp(schedule.updatedAt),
  };
}

export function mapSupplierQuoteForSupplier(quote: OpsSupplierQuote) {
  const { acceptableMin, acceptableMax, outsideAcceptableRange, ...safeQuote } = mapSupplierQuote(quote);
  return safeQuote;
}

export function mapQuoteRequestTokenDetail({ request, event, quote }: QuoteRequestTokenDetail) {
  return {
    request: mapSupplierQuoteRequest(request),
    quote: quote ? mapSupplierQuoteForSupplier(quote) : null,
    eventId: event.id,
    eventName: request.confidentialBid ? 'Confidential event' : event.eventName,
    clientName: request.confidentialBid ? null : event.clientName,
    eventDate: request.confidentialBid ? null : isoDate(event.eventDate),
  };
}
