import {
  SupplierQuoteRequestStatus,
  SupplierQuoteStatus,
  isOpsConstantValue,
  type SupplierQuoteRequestStatus as SupplierQuoteRequestStatusValue,
} from '@prism/kernel/event-core';

const CLOSED_REQUEST_STATUSES: ReadonlySet<string> = new Set([
  SupplierQuoteRequestStatus.Selected,
  SupplierQuoteRequestStatus.Closed,
  SupplierQuoteRequestStatus.Expired,
]);

const LOCKED_QUOTE_STATUSES: ReadonlySet<string> = new Set([
  SupplierQuoteStatus.Selected,
  SupplierQuoteStatus.Locked,
]);

const EXPIRABLE_REQUEST_STATUSES: ReadonlySet<string> = new Set([
  SupplierQuoteRequestStatus.Open,
  SupplierQuoteRequestStatus.RevisionRequested,
]);

/**
 * A quote request is closed once a supplier has been Selected for the
 * category, the request itself was explicitly Closed (e.g. superseded by
 * another selection), or it Expired past its due date. No further
 * submit/revise activity is accepted against a closed request.
 */
export function isSupplierQuoteRequestClosed(status: string): boolean {
  return CLOSED_REQUEST_STATUSES.has(status);
}

/**
 * A supplier quote is locked once it has been Selected or explicitly
 * Locked; locked quotes reject further revision and re-selecting one is a
 * safe no-op rather than an error.
 */
export function isSupplierQuoteLocked(status: string): boolean {
  return LOCKED_QUOTE_STATUSES.has(status);
}

/**
 * An Open or RevisionRequested quote request whose due date has passed
 * auto-expires to Expired. Every other status (including no due date, a
 * future due date, or an already-terminal status) passes through
 * unchanged.
 */
export function resolveExpiredQuoteRequestStatus(input: {
  status: string;
  dueDate: Date | null;
}): SupplierQuoteRequestStatusValue | string {
  if (
    input.dueDate &&
    input.dueDate.getTime() < Date.now() &&
    isOpsConstantValue(SupplierQuoteRequestStatus, input.status) &&
    EXPIRABLE_REQUEST_STATUSES.has(input.status)
  ) {
    return SupplierQuoteRequestStatus.Expired;
  }
  return input.status;
}

