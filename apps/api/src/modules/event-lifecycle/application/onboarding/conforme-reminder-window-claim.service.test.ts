import { ConflictException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConformeReminderWindowClaimService } from './conforme-reminder-window-claim.service';

const NOW = new Date('2026-09-24T12:00:00.000Z');
const SENT_AT = new Date(NOW.getTime() - 6 * 24 * 60 * 60 * 1000);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => vi.useRealTimers());

type TestInquiry = {
  id: string;
  clientName: string;
  email: string;
  status: string;
  conformeSentAt: Date | null;
  conformeSignedAt: Date | null;
  lastConformeReminderAt: Date | null;
};

function createInquiry(overrides: Partial<TestInquiry> = {}): TestInquiry {
  return {
    id: 'inq_1',
    clientName: 'Ana Reyes',
    email: 'ana@customer.test',
    status: 'accepted',
    conformeSentAt: SENT_AT,
    conformeSignedAt: null,
    lastConformeReminderAt: null,
    ...overrides,
  };
}

function createService(inquiry: ReturnType<typeof createInquiry>) {
  const updateMany = vi.fn(async ({ where, data }: any) => {
    const matches = inquiry.id === where.id &&
      inquiry.status === where.status &&
      inquiry.conformeSignedAt === where.conformeSignedAt &&
      (inquiry.conformeSentAt?.getTime() ?? null) === (where.conformeSentAt?.getTime() ?? null) &&
      (inquiry.lastConformeReminderAt?.getTime() ?? null) === (where.lastConformeReminderAt?.getTime() ?? null);
    if (!matches) return { count: 0 };
    Object.assign(inquiry, data);
    return { count: 1 };
  });
  const tx = {
    opsInquiry: {
      findUnique: vi.fn(async ({ where }: any) => where.id === inquiry.id ? inquiry : null),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => where.id === inquiry.id ? inquiry : null),
      updateMany,
    },
  };
  return {
    service: new ConformeReminderWindowClaimService({ opsInquiry: tx.opsInquiry } as never),
    tx,
  };
}

describe('ConformeReminderWindowClaimService', () => {
  it('returns only inquiry identity/timestamps for an eligible, unsigned conforme', async () => {
    const { service } = createService(createInquiry());

    await expect(service.requireEligible('inq_1')).resolves.toEqual({
      inquiryId: 'inq_1',
      status: 'accepted',
      conformeSentAt: SENT_AT.toISOString(),
      conformeSignedAt: null,
      lastConformeReminderAt: null,
      reminderWindowBaseAt: SENT_AT.toISOString(),
    });
  });

  it.each([
    ['status', { status: 'new' }],
    ['signed conforme', { conformeSignedAt: NOW }],
    ['missing sent conforme', { conformeSentAt: null }],
    ['under five days', { conformeSentAt: new Date(NOW.getTime() - 4 * 24 * 60 * 60 * 1000) }],
    ['under five days after a reminder', { lastConformeReminderAt: new Date(NOW.getTime() - 4 * 24 * 60 * 60 * 1000) }],
  ])('rejects a draft for an ineligible %s inquiry', async (_label, overrides) => {
    const { service } = createService(createInquiry(overrides));

    await expect(service.requireEligible('inq_1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('claims the exact reminder window and resolves the recipient from the inquiry record', async () => {
    const inquiry = createInquiry();
    const { service, tx } = createService(inquiry);
    const result = await service.claim({
      inquiryId: 'inq_1',
      expectedConformeSentAt: SENT_AT.toISOString(),
      expectedLastConformeReminderAt: null,
      now: NOW,
    }, { prisma: tx as never, correlationId: 'approval' });

    expect(result).toEqual({
      windowKey: `conforme-follow-up:inq_1:${SENT_AT.getTime()}`,
      recipient: 'ana@customer.test',
      lastConformeReminderAt: NOW.toISOString(),
    });
    expect(tx.opsInquiry.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.opsInquiry.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'inq_1',
        status: 'accepted',
        conformeSentAt: SENT_AT,
        conformeSignedAt: null,
        lastConformeReminderAt: null,
      },
      data: { lastConformeReminderAt: NOW },
    });
  });

  it('rejects a window already claimed by the scheduled reminder', async () => {
    const inquiry = createInquiry({ lastConformeReminderAt: new Date(NOW.getTime() - 1_000) });
    const { service, tx } = createService(inquiry);

    await expect(service.claim({
      inquiryId: 'inq_1',
      expectedConformeSentAt: SENT_AT.toISOString(),
      expectedLastConformeReminderAt: null,
      now: NOW,
    }, { prisma: tx as never, correlationId: 'approval' })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.opsInquiry.updateMany).not.toHaveBeenCalled();
  });
});
