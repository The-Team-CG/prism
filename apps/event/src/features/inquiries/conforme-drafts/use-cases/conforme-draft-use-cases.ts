import type { CommsDraftResult } from '@prism/types';
import { conformeDraftRepository } from '../data/conforme-draft-repository';

export async function loadConformeDraft(inquiryId: string) {
  return conformeDraftRepository.getForInquiry(inquiryId);
}

export async function generateConformeDraft(
  inquiryId: string,
  signal: AbortSignal,
  onDelta: (text: string) => void,
) {
  let completed = false;
  for await (const event of conformeDraftRepository.stream({ inquiryId }, signal)) {
    if (event.type === 'delta') onDelta(event.text);
    if (event.type === 'failure') {
      throw new Error(event.result.outcome === 'aborted' ? 'cancelled' : 'unavailable');
    }
    if (event.type === 'complete') completed = true;
  }
  if (!completed) throw new Error('unavailable');
  const saved = await conformeDraftRepository.getForInquiry(inquiryId);
  if (!saved) throw new Error('unavailable');
  return saved;
}

export function saveManualConformeDraft(inquiryId: string, draft: CommsDraftResult) {
  return conformeDraftRepository.saveManual(inquiryId, draft);
}

export function approveConformeDraft(draftId: string, draft: CommsDraftResult) {
  return conformeDraftRepository.approve(draftId, draft);
}

export function cancelConformeDraft(draftId: string) {
  return conformeDraftRepository.cancel(draftId);
}
