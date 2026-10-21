import type { PrismClientChangeRequest } from '@prism/types';

// Internal exception states map to neutral client wording; a pending request is still under review.
const CLIENT_CHANGE_REQUEST_STATUS = {
  pending: 'under_review',
  approved: 'approved',
  rejected: 'not_approved',
} as const;

/** The only freeze-exception columns a client projection may read. Reason, decision note, and actors stay PMCM-internal. */
export const CLIENT_CHANGE_REQUEST_SELECT = {
  id: true,
  requestedChange: true,
  status: true,
  requestedAt: true,
  decidedAt: true,
} as const;

export type ClientChangeRequestSource = {
  id: string;
  requestedChange: string;
  status: string;
  requestedAt: Date;
  decidedAt: Date | null;
};

export function toClientChangeRequest(value: ClientChangeRequestSource): PrismClientChangeRequest & { status: Exclude<PrismClientChangeRequest['status'], 'withdrawn'> } {
  return {
    id: value.id,
    source: 'freeze_exception',
    category: null,
    clientResponse: null,
    requestedChange: value.requestedChange,
    status: CLIENT_CHANGE_REQUEST_STATUS[value.status as keyof typeof CLIENT_CHANGE_REQUEST_STATUS] ?? 'under_review',
    updatedAt: (value.decidedAt ?? value.requestedAt).toISOString(),
  };
}
