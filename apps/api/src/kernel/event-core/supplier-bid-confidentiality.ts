import { SupplierQuoteRequestStatus } from './ops.constants';

/** The masked event name a supplier sees while a confidential bid is undecided. */
export const CONFIDENTIAL_EVENT_NAME = 'Confidential event';

/** A confidential bid hides who the event is for until that supplier wins it; the date stays visible for pricing (FR-49). */
export function isSupplierBidIdentityHidden(request: { confidentialBid: boolean; status: string }): boolean {
  return request.confidentialBid && request.status !== SupplierQuoteRequestStatus.Selected;
}
