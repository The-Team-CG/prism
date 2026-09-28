// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import type {
  AiGatewayStreamEvent,
  CommsDraftResult,
  ConformeDraftReviewRecord,
  PrismInquiry,
} from '@prism/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConformeDraftReviewViewModel } from './use-conforme-draft-review-view-model';

const repository = vi.hoisted(() => ({
  getForInquiry: vi.fn(),
  stream: vi.fn(),
  saveManual: vi.fn(),
  approve: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock('../data/conforme-draft-repository', () => ({ conformeDraftRepository: repository }));

const inquiry = {
  id: 'inq_1',
  status: 'accepted',
  conformeSentAt: '2026-09-19T12:00:00.000Z',
  conformeSignedAt: null,
} as PrismInquiry;

const savedDraft: ConformeDraftReviewRecord = {
  draftId: 'aia_1',
  inquiryId: 'inq_1',
  draft: { subject: 'A synthetic subject', body: 'A validated synthetic draft.' },
  status: 'pending_human_approval',
  source: 'ai',
  requestedAt: '2026-09-24T12:00:00.000Z',
  reviewedBy: null,
  reviewedAt: null,
  lastConformeReminderAt: null,
  reminderWindowBaseAt: '2026-09-19T12:00:00.000Z',
  requestId: 'req_1',
  modelVersion: 'mock',
};

type DraftEvent = AiGatewayStreamEvent<CommsDraftResult>;
const metadataEvent: DraftEvent = { type: 'meta', requestId: 'req_1', useCaseId: 'comms.draft' };
const deltaEvent: DraftEvent = { type: 'delta', requestId: 'req_1', sequence: 0, text: 'unvalidated stream fragment' };
const completeEvent: DraftEvent = {
  type: 'complete',
  requestId: 'req_1',
  result: {} as never,
};
const failureEvent: DraftEvent = {
  type: 'failure',
  requestId: 'req_1',
  result: { outcome: 'aborted' } as never,
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('useConformeDraftReviewViewModel', () => {
  beforeEach(() => vi.resetAllMocks());

  it('waits for metadata, withholds draft content through deltas, and reveals only the saved validated draft', async () => {
    const metadataGate = deferred();
    const completionGate = deferred();
    repository.getForInquiry.mockResolvedValueOnce(null).mockResolvedValueOnce(savedDraft);
    repository.stream.mockImplementation(() => (async function* () {
      await metadataGate.promise;
      yield metadataEvent;
      yield deltaEvent;
      await completionGate.promise;
      yield completeEvent;
    })());

    const { result } = renderHook(() => useConformeDraftReviewViewModel(inquiry));
    await waitFor(() => expect(result.current.status).toBe('idle'));

    let generation: Promise<void> | undefined;
    act(() => { generation = result.current.generate(); });
    await waitFor(() => expect(result.current.status).toBe('starting'));
    expect(result.current.subject).toBe('');
    expect(result.current.body).toBe('');

    act(() => metadataGate.resolve());
    await waitFor(() => expect(result.current.status).toBe('generating'));
    expect(result.current.subject).toBe('');
    expect(result.current.body).toBe('');
    expect('streamedCharacters' in result.current).toBe(false);

    act(() => completionGate.resolve());
    await act(async () => { await generation; });
    expect(result.current.status).toBe('pending');
    expect(result.current.subject).toBe(savedDraft.draft.subject);
    expect(result.current.body).toBe(savedDraft.draft.body);
  });

  it('keeps a cancelled generation locked until the aborted stream ends, then permits retry', async () => {
    const abortObserved = deferred();
    const finishAbort = deferred();
    repository.getForInquiry.mockResolvedValue(null);
    repository.stream
      .mockImplementationOnce((_input: unknown, signal: AbortSignal) => (async function* () {
        yield metadataEvent;
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            abortObserved.resolve();
            void finishAbort.promise.then(() => reject(signal.reason ?? new Error('aborted')));
          }, { once: true });
        });
      })())
      .mockImplementationOnce(async function* () {
        yield metadataEvent;
        yield failureEvent;
      });

    const { result } = renderHook(() => useConformeDraftReviewViewModel(inquiry));
    await waitFor(() => expect(result.current.status).toBe('idle'));

    let generation: Promise<void> | undefined;
    act(() => { generation = result.current.generate(); });
    await waitFor(() => expect(result.current.status).toBe('generating'));

    act(() => result.current.cancelGeneration());
    expect(result.current.status).toBe('cancelling');
    await abortObserved.promise;
    act(() => { void result.current.generate(); });
    expect(repository.stream).toHaveBeenCalledTimes(1);

    act(() => finishAbort.resolve());
    await act(async () => { await generation; });
    await waitFor(() => expect(result.current.status).toBe('idle'));

    let retry: Promise<void> | undefined;
    act(() => { retry = result.current.generate(); });
    await act(async () => { await retry; });
    expect(repository.stream).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('unavailable');
  });
});
