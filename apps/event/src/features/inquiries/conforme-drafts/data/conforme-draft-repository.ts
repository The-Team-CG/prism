import { createEventOpsClient } from '@prism/api-client';
import type { CommsDraftRequest, CommsDraftResult } from '@prism/types';
import { readStoredEventSession } from '@/app/lib/session';
import { parseConformeDraftReview } from '../model/conforme-draft-review';

const client = createEventOpsClient({
  baseUrl: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api`,
  getAuthToken: () => readStoredEventSession()?.accessToken ?? null,
});

export const conformeDraftRepository = {
  async getForInquiry(inquiryId: string) {
    return parseConformeDraftReview(await client.conformeDrafts.getForInquiry(inquiryId));
  },

  stream(input: CommsDraftRequest, signal: AbortSignal) {
    return client.conformeDrafts.stream(input, signal);
  },

  async saveManual(inquiryId: string, draft: CommsDraftResult) {
    return parseConformeDraftReview(await client.conformeDrafts.saveManual(inquiryId, draft));
  },

  async approve(draftId: string, draft: CommsDraftResult) {
    return parseConformeDraftReview(await client.conformeDrafts.approve(draftId, draft));
  },

  async cancel(draftId: string) {
    return parseConformeDraftReview(await client.conformeDrafts.cancel(draftId));
  },
};
