import {
  inquiryTriageReviewSchema,
  type InquiryTriageAction,
  type InquiryTriageFit,
  type InquiryTriageReview,
} from '@prism/types';

const FIT_LABELS: Record<InquiryTriageFit, string> = {
  high: 'Strong fit',
  medium: 'Possible fit',
  low: 'Weak fit',
};

const ACTION_LABELS: Record<InquiryTriageAction, string> = {
  accept: 'Consider accepting',
  pend: 'Consider putting on hold',
  decline: 'Consider declining',
  request_more_info: 'Ask the client for more detail',
};

export const fitLabel = (fit: InquiryTriageFit) => FIT_LABELS[fit];
export const actionLabel = (action: InquiryTriageAction) => ACTION_LABELS[action];

/** A missing review is `null`; anything else must match the shared contract. */
export function parseInquiryTriageReview(value: unknown): InquiryTriageReview | null {
  if (value === null || value === undefined) return null;
  const parsed = inquiryTriageReviewSchema.safeParse(value);
  if (!parsed.success) throw new Error('The triage response was not valid. Refresh and try again.');
  return parsed.data;
}
