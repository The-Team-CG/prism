import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiAuditEvidence, AiGatewayStreamEvent, CommsDraftResult } from '@prism/types';
import { createEventOpsClient } from './index';
import { prismSse } from './http';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('conforme draft streaming client', () => {
  it('posts only the inquiry identity with session auth and parses the typed stream', async () => {
    const output: CommsDraftResult = { subject: 'Follow-up', body: 'Please contact our team with questions.' };
    const evidence: AiAuditEvidence = {
      requestId: 'req_1',
      useCaseId: 'comms.draft',
      promptVersion: 'comms-draft-v1',
      profileId: 'mock',
      provider: 'mock',
      requestedModel: 'mock',
      zdrBasis: 'none',
      dataClasses: ['synthetic'],
      latencyMs: 10,
      outcome: 'completed',
      approvalState: 'pending',
    };
    const event: AiGatewayStreamEvent<CommsDraftResult> = {
      type: 'complete',
      requestId: 'req_1',
      result: { outcome: 'completed', output, evidence },
    };
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoded = new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
        controller.enqueue(encoded.slice(0, 18));
        controller.enqueue(encoded.slice(18));
        controller.close();
      },
    });
    const fetchMock = vi.fn(async () => new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const client = createEventOpsClient({
      baseUrl: 'http://localhost:4000/api',
      getAuthToken: () => 'session-token',
    });

    const received: AiGatewayStreamEvent<CommsDraftResult>[] = [];
    for await (const value of client.conformeDrafts.stream({ inquiryId: 'inq_1' }, new AbortController().signal)) {
      received.push(value);
    }

    expect(received).toEqual([event]);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4000/api/comms-drafts/stream', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ inquiryId: 'inq_1' }),
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        Authorization: 'Bearer session-token',
      },
    }));
  });

  it('decodes split CRLF data lines and a final event without a blank line', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('data: {"subject":\r\n'));
        controller.enqueue(encoder.encode('data: "Follow-up"}'));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })));

    const received: unknown[] = [];
    for await (const value of prismSse('/stream', { baseUrl: 'http://localhost:4000/api' }, (value) => value)) {
      received.push(value);
    }
    expect(received).toEqual([{ subject: 'Follow-up' }]);
  });
});
