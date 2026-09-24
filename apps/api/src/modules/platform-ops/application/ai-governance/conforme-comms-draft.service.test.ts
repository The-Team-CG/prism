import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { AiAuditEvidence, AiGatewayStreamEvent, CommsDraftResult, PrismVerifiedEventActor } from '@prism/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConformeCommsDraftService } from './conforme-comms-draft.service';

const NOW = new Date('2026-09-24T12:00:00.000Z');
const SENT_AT = new Date(NOW.getTime() - 6 * 24 * 60 * 60 * 1000);
const ORIGINAL_DRAFT: CommsDraftResult = {
  subject: 'A quick follow-up on your event conforme',
  body: 'Hello, please let our team know if you have questions about the conforme.',
};
const EVIDENCE: AiAuditEvidence = {
  requestId: 'req_comms_1',
  useCaseId: 'comms.draft',
  promptVersion: 'comms-draft-v1',
  profileId: 'mock',
  provider: 'mock',
  requestedModel: 'mock',
  zdrBasis: 'none',
  dataClasses: ['synthetic'],
  latencyMs: 12,
  outcome: 'completed',
  approvalState: 'pending',
};
const STREAM_EVENTS: AiGatewayStreamEvent<CommsDraftResult>[] = [
  { type: 'meta', requestId: EVIDENCE.requestId, useCaseId: 'comms.draft' },
  { type: 'delta', requestId: EVIDENCE.requestId, sequence: 0, text: '{"subject":' },
  {
    type: 'complete',
    requestId: EVIDENCE.requestId,
    result: { outcome: 'completed', output: ORIGINAL_DRAFT, evidence: EVIDENCE },
  },
];

afterEach(() => vi.useRealTimers());

function verifiedActor(role: string = 'pmcm-admin') {
  return { id: 'user_1', actorId: 'user_1', role, actorRole: role, name: 'Verified PMCM', actorName: 'Verified PMCM', email: 'pmcm@example.test', actorEmail: 'pmcm@example.test', expiresAt: NOW.toISOString() } as PrismVerifiedEventActor;
}

function equalNullableDate(left: unknown, right: unknown) {
  if (left === null || right === null) return left === right;
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
  return left === right;
}

function snapshotInquiry(inquiry: Record<string, any>) {
  const conformeSentAt = inquiry.conformeSentAt?.toISOString() ?? null;
  const lastConformeReminderAt = inquiry.lastConformeReminderAt?.toISOString() ?? null;
  return {
    inquiryId: inquiry.id,
    status: inquiry.status,
    conformeSentAt,
    conformeSignedAt: inquiry.conformeSignedAt?.toISOString() ?? null,
    lastConformeReminderAt,
    reminderWindowBaseAt: lastConformeReminderAt ?? conformeSentAt,
  };
}

function createHarness(options: { status?: string; sentAt?: Date | null; signedAt?: Date | null; lastReminderAt?: Date | null } = {}) {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const state = {
    inquiry: {
      id: 'inq_1',
      clientName: 'Ana Reyes',
      email: 'ana@customer.test',
      eventName: 'Summit 2026',
      status: options.status ?? 'accepted',
      conformeSentAt: options.sentAt === undefined ? SENT_AT : options.sentAt,
      conformeSignedAt: options.signedAt ?? null,
      lastConformeReminderAt: options.lastReminderAt ?? null,
      followUpIntervalDays: 3,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
    },
    audits: new Map<string, any>(),
    approvals: new Map<string, any>(),
    notifications: [] as any[],
  };
  const tx = {
    opsInquiry: {
      findUnique: vi.fn(async ({ where }: any) => where.id === state.inquiry.id ? state.inquiry : null),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        if (where.id !== state.inquiry.id) throw new Error('missing inquiry');
        return state.inquiry;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const current = state.inquiry;
        const matches = current.id === where.id &&
          current.status === where.status &&
          current.conformeSignedAt === where.conformeSignedAt &&
          equalNullableDate(current.conformeSentAt, where.conformeSentAt) &&
          equalNullableDate(current.lastConformeReminderAt, where.lastConformeReminderAt);
        if (!matches) return { count: 0 };
        Object.assign(current, data);
        return { count: 1 };
      }),
    },
    opsAiAuditLog: {
      create: vi.fn(async ({ data }: any) => { state.audits.set(data.id, { ...data }); return state.audits.get(data.id); }),
      findUnique: vi.fn(async ({ where }: any) => state.audits.get(where.id) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const row = state.audits.get(where.id);
        if (!row) throw new Error('missing audit');
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const row = state.audits.get(where.id);
        if (!row || row.status !== where.status) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
    opsAiApprovalRecord: {
      create: vi.fn(async ({ data }: any) => { state.approvals.set(data.id, { ...data }); return state.approvals.get(data.id); }),
      findUnique: vi.fn(async ({ where }: any) => where.id
        ? [...state.approvals.values()].find((row) => row.id === where.id) ?? null
        : [...state.approvals.values()].find((row) => row.sourceDispatchId === where.sourceDispatchId) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const row = [...state.approvals.values()].find((item) => item.id === where.id);
        if (!row) throw new Error('missing approval');
        return row;
      }),
      findMany: vi.fn(async ({ where }: any) => [...state.approvals.values()].filter((row) =>
        row.featureName === where.featureName && row.sourceDispatchId.startsWith(where.sourceDispatchId.startsWith),
      ).sort((left, right) => right.requestedAt.getTime() - left.requestedAt.getTime()).slice(0, where.take)),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const row = state.approvals.get(where.id);
        if (!row || row.status !== where.status) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
    opsNotificationLog: {
      upsert: vi.fn(async ({ create }: any) => {
        const existing = state.notifications.find((row) => row.idempotencyKey === create.idempotencyKey);
        if (existing) return existing;
        state.notifications.push(create);
        return create;
      }),
      findFirst: vi.fn(async () => null),
    },
  };
  const cloneState = () => structuredClone(state);
  const restoreState = (snapshot: typeof state) => {
    state.inquiry = snapshot.inquiry;
    state.audits.clear();
    for (const entry of snapshot.audits) state.audits.set(entry[0], entry[1]);
    state.approvals.clear();
    for (const entry of snapshot.approvals) state.approvals.set(entry[0], entry[1]);
    state.notifications.splice(0, state.notifications.length, ...snapshot.notifications);
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => {
      const snapshot = cloneState();
      try {
        return await callback(tx);
      } catch (error) {
        restoreState(snapshot);
        throw error;
      }
    }),
  };
  const gateway = {
    stream: vi.fn(() => (async function* () { yield* STREAM_EVENTS; })()),
  };
  const policy = {
    resolveActor: vi.fn((_input, actor) => ({ id: actor.actorId, role: actor.actorRole, name: actor.actorName, verified: true })),
    requireActorRole: vi.fn(async (actor, roles) => {
      if (!roles.includes(actor.role)) throw new ForbiddenException('PMCM role required');
    }),
  };
  const notificationOutboxWriter = {
    write: vi.fn(async (input: any, context: any) => context.prisma.opsNotificationLog.upsert({ create: input })),
  };
  const reminderWindowClaimer = {
    getInquiry: vi.fn(async (inquiryId: string) => inquiryId === state.inquiry.id ? snapshotInquiry(state.inquiry) : null),
    requireEligible: vi.fn(async (inquiryId: string) => {
      const snapshot = inquiryId === state.inquiry.id ? snapshotInquiry(state.inquiry) : null;
      if (!snapshot) throw new Error('Inquiry not found');
      if (snapshot.status !== 'accepted') throw new ConflictException('Only accepted inquiries can receive a conforme draft');
      if (snapshot.conformeSignedAt) throw new ConflictException('The conforme has already been signed');
      if (!snapshot.conformeSentAt) throw new ConflictException('The conforme must be sent before a draft is available');
      const reminderBase = snapshot.lastConformeReminderAt ?? snapshot.conformeSentAt;
      if (Date.now() - Date.parse(reminderBase) < 5 * 24 * 60 * 60 * 1000) {
        throw new ConflictException('Inquiry is not eligible');
      }
      return { ...snapshot, status: 'accepted' as const, conformeSignedAt: null, conformeSentAt: snapshot.conformeSentAt, reminderWindowBaseAt: snapshot.reminderWindowBaseAt! };
    }),
    claim: vi.fn(async (input: any, context: any) => {
      const expectedConformeSentAt = new Date(input.expectedConformeSentAt);
      const expectedLastConformeReminderAt = input.expectedLastConformeReminderAt
        ? new Date(input.expectedLastConformeReminderAt)
        : null;
      const now = input.now ?? new Date();
      const claimed = await context.prisma.opsInquiry.updateMany({
        where: {
          id: input.inquiryId,
          status: 'accepted',
          conformeSentAt: expectedConformeSentAt,
          conformeSignedAt: null,
          lastConformeReminderAt: expectedLastConformeReminderAt,
        },
        data: { lastConformeReminderAt: now },
      });
      if (claimed.count !== 1) throw new ConflictException('The reminder window changed');
      const inquiry = await context.prisma.opsInquiry.findUniqueOrThrow({ where: { id: input.inquiryId } });
      const windowBase = expectedLastConformeReminderAt ?? expectedConformeSentAt;
      return {
        windowKey: `conforme-follow-up:${input.inquiryId}:${windowBase.getTime()}`,
        recipient: inquiry.email.trim(),
        lastConformeReminderAt: inquiry.lastConformeReminderAt.toISOString(),
      };
    }),
  };
  const service = new ConformeCommsDraftService(
    prisma as never,
    gateway as never,
    notificationOutboxWriter as never,
    policy as never,
    reminderWindowClaimer as never,
  );
  return { service, state, gateway, policy, notificationOutboxWriter, prisma, reminderWindowClaimer };
}

async function consume(stream: AsyncIterable<AiGatewayStreamEvent<CommsDraftResult>>) {
  const events: AiGatewayStreamEvent<CommsDraftResult>[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

describe('ConformeCommsDraftService', () => {
  it('streams with inquiry identity only, persists a pending validated draft, and queues nothing', async () => {
    const { service, state, gateway } = createHarness();
    const stream = await service.prepareStream({ inquiryId: 'inq_1' }, verifiedActor(), new AbortController().signal);
    const events = await consume(stream);

    expect(gateway.stream).toHaveBeenCalledWith('comms.draft', { inquiryId: 'inq_1' }, expect.any(Object));
    expect(events[events.length - 1]?.type).toBe('complete');
    expect(state.approvals.size).toBe(1);
    expect([...state.approvals.values()][0].status).toBe('pending_human_approval');
    expect([...state.audits.values()][0].sanitizedPayload).toMatchObject({
      inquiryId: 'inq_1',
      reminderWindowBaseAt: SENT_AT.toISOString(),
      source: 'ai',
      evidence: { requestId: EVIDENCE.requestId, useCaseId: 'comms.draft', profileId: 'mock' },
    });
    expect(state.notifications).toHaveLength(0);
  });

  it('rejects forbidden roles and ineligible inquiry state before streaming', async () => {
    const forbidden = createHarness();
    await expect(forbidden.service.prepareStream({ inquiryId: 'inq_1' }, verifiedActor('coordinator')))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(forbidden.gateway.stream).not.toHaveBeenCalled();

    const stale = createHarness({ status: 'new' });
    await expect(stale.service.prepareStream({ inquiryId: 'inq_1' }, verifiedActor()))
      .rejects.toBeInstanceOf(ConflictException);
    expect(stale.gateway.stream).not.toHaveBeenCalled();
  });

  it('rejects stale approval when the standard reminder already claimed the window', async () => {
    const { service, state } = createHarness();
    const events = await consume(await service.prepareStream({ inquiryId: 'inq_1' }, verifiedActor()));
    const complete = events.find((event) => event.type === 'complete');
    if (!complete || complete.type !== 'complete') throw new Error('missing complete event');
    const draftId = [...state.approvals.values()][0].id;
    state.inquiry.lastConformeReminderAt = new Date(NOW.getTime() - 1_000);

    await expect(service.approve(draftId, complete.result.output, verifiedActor()))
      .rejects.toBeInstanceOf(ConflictException);
    expect(state.notifications).toHaveLength(0);
    expect([...state.approvals.values()][0].status).toBe('pending_human_approval');
  });

  it('aborts the stream without persisting a partial draft or queuing a message', async () => {
    const { service, state } = createHarness();
    const controller = new AbortController();
    const stream = await service.prepareStream({ inquiryId: 'inq_1' }, verifiedActor(), controller.signal);
    const iterator = stream[Symbol.asyncIterator]();
    expect((await iterator.next()).value?.type).toBe('meta');
    expect((await iterator.next()).value?.type).toBe('delta');
    controller.abort(new Error('cancelled by PMCM'));

    await expect(iterator.next()).rejects.toThrow('cancelled by PMCM');
    expect(state.approvals.size).toBe(0);
    expect(state.notifications).toHaveLength(0);
  });

  it('rechecks eligibility before persisting a completed generation', async () => {
    const { service, state } = createHarness();
    const stream = await service.prepareStream({ inquiryId: 'inq_1' }, verifiedActor());
    const iterator = stream[Symbol.asyncIterator]();
    await iterator.next();
    await iterator.next();
    state.inquiry.conformeSignedAt = NOW;

    await expect(iterator.next()).rejects.toThrow('The conforme has already been signed');
    expect(state.approvals.size).toBe(0);
    expect(state.notifications).toHaveLength(0);
  });

  it('queues the approved edited message once to the server-owned recipient', async () => {
    const { service, state, notificationOutboxWriter } = createHarness();
    await consume(await service.prepareStream({ inquiryId: 'inq_1' }, verifiedActor()));
    const approval = [...state.approvals.values()][0];
    const edited = { subject: 'Updated subject', body: 'PMCM-approved wording.' };

    const approved = await service.approve(approval.id, edited, verifiedActor());
    expect(approved.status).toBe('approved');
    expect(approved.draft).toEqual(edited);
    expect(approved.lastConformeReminderAt).toBe(NOW.toISOString());
    expect(state.inquiry.lastConformeReminderAt).toEqual(NOW);
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0]).toMatchObject({
      eventId: undefined,
      recipient: 'ana@customer.test',
      message: 'Updated subject\n\nPMCM-approved wording.',
      channel: 'email',
    });
    expect(state.notifications[0].idempotencyKey).toContain(approval.sourceDispatchId.split(':draft')[0]);
    expect(approval.approvedBy).toBe('Verified PMCM');

    await expect(service.approve(approval.id, edited, verifiedActor())).rejects.toBeInstanceOf(ConflictException);
    expect(notificationOutboxWriter.write).toHaveBeenCalledTimes(1);

    state.inquiry.lastConformeReminderAt = new Date(NOW.getTime() + 6 * 24 * 60 * 60 * 1000);
    const historical = await service.loadForInquiry('inq_1', verifiedActor());
    expect(historical?.lastConformeReminderAt).toBe(NOW.toISOString());
  });

  it('supports manual writing while keeping the message pending until approval', async () => {
    const { service, state } = createHarness();
    const manual = await service.saveManual('inq_1', { subject: 'Manual', body: 'Written by PMCM.' }, verifiedActor());
    expect(manual.source).toBe('manual');
    expect(manual.status).toBe('pending_human_approval');
    expect(state.notifications).toHaveLength(0);

    await service.approve(manual.draftId, manual.draft, verifiedActor());
    expect(state.notifications).toHaveLength(1);
  });

  it('cancels a draft without enqueuing a message', async () => {
    const { service, state } = createHarness();
    await consume(await service.prepareStream({ inquiryId: 'inq_1' }, verifiedActor()));
    const approval = [...state.approvals.values()][0];

    const cancelled = await service.cancel(approval.id, verifiedActor());
    expect(cancelled.status).toBe('rejected');
    expect(cancelled.reviewedBy).toBe('Verified PMCM');
    expect(state.notifications).toHaveLength(0);
  });
});
