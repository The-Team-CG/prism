import { eventApi } from '@/lib/prism-api';
import { parseInquiryTriageReview } from '../model/inquiry-triage';

export const inquiryTriageRepository = {
  async latest(inquiryId: string) {
    return parseInquiryTriageReview(await eventApi.inquiries.triageReview(inquiryId));
  },

  async run(inquiryId: string) {
    return parseInquiryTriageReview(await eventApi.inquiries.runTriage(inquiryId));
  },
};
