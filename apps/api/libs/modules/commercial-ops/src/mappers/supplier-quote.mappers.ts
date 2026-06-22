import type { OpsSupplierQuote, OpsSupplierQuoteRequest } from '@prisma/client';
import { SupplierVerificationStatus } from '@prism/modules/event-core';
import type { QuoteRequestTokenDetail } from '../services/commercial-workflow.service';

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

export function mapSupplierQuote(quote: OpsSupplierQuote) {
  const expanded = quote as OpsSupplierQuote & {
    revisionNumber?: number;
    revisedAt?: Date | null;
    lockedAt?: Date | null;
    updatedAt?: Date | null;
  };
  const inclusions = Array.isArray(quote.inclusions) ? (quote.inclusions as string[]) : [];
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
    revisionNumber: expanded.revisionNumber ?? 1,
    revisedAt: expanded.revisedAt ? timestamp(expanded.revisedAt) : null,
    selectedAt: quote.selectedAt ? timestamp(quote.selectedAt) : null,
    lockedAt: expanded.lockedAt ? timestamp(expanded.lockedAt) : null,
    createdAt: timestamp(quote.createdAt),
    updatedAt: expanded.updatedAt ? timestamp(expanded.updatedAt) : timestamp(quote.createdAt),
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
