import type { InquiryTriageRequest } from '@prism/types';
import { eventApiRequest } from '@/lib/prism-api';
import { parseInquiryTriageReview } from '../model/inquiry-triage';

export const inquiryTriageRepository = {
  async latest(inquiryId: string) {
    return parseInquiryTriageReview(
      await eventApiRequest<unknown>(`/api/inquiry-triage/${encodeURIComponent(inquiryId)}`),
    );
  },

  async run(inquiryId: string) {
    const body: InquiryTriageRequest = { inquiryId };
    return parseInquiryTriageReview(
      await eventApiRequest<unknown>('/api/inquiry-triage', { method: 'POST', body }),
    );
  },
};
