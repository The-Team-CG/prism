import { ConflictException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimConformeReminderWindow, claimConformeReminderWindowState } from './conforme-reminder-window';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-24T12:00:00.000Z'));
});

afterEach(() => vi.useRealTimers());

describe('claimConformeReminderWindow', () => {
  it('claims once and writes each reminder channel with a shared window key', async () => {
    const inquiry = { id: 'inq_1', lastConformeReminderAt: new Date('2026-09-24T12:00:00.000Z') };
    const tx = {
      opsInquiry: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        findUniqueOrThrow: vi.fn(async () => inquiry),
      },
      opsNotificationLog: {},
    };
    const writer = { write: vi.fn(async () => undefined) };
    const sentAt = new Date('2026-09-15T12:00:00.000Z');
    const lastReminderAt = new Date('2026-09-18T12:00:00.000Z');
    const now = new Date('2026-09-24T12:00:00.000Z');

    await expect(claimConformeReminderWindow(tx as never, writer as never, {
      inquiryId: 'inq_1',
      conformeSentAt: sentAt,
      expectedLastReminderAt: lastReminderAt,
      now,
      messages: [
        { recipient: 'client@example.test', message: 'Email follow-up', channel: 'email' },
        { recipient: 'client', message: 'Viber follow-up', channel: 'viber' },
      ],
    })).resolves.toMatchObject({ inquiry });

    expect(tx.opsInquiry.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'inq_1',
        status: 'accepted',
        conformeSentAt: sentAt,
        conformeSignedAt: null,
        lastConformeReminderAt: lastReminderAt,
      },
      data: { lastConformeReminderAt: now },
    });
    expect(writer.write).toHaveBeenCalledTimes(2);
    expect(writer.write).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ recipient: 'client@example.test', channel: 'email', idempotencyKey: 'conforme-follow-up:inq_1:1789732800000:email' }),
      expect.objectContaining({ prisma: tx, correlationId: 'conforme-follow-up:inq_1:1789732800000' }),
    );
    expect(writer.write).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ channel: 'viber', idempotencyKey: 'conforme-follow-up:inq_1:1789732800000:viber' }),
      expect.objectContaining({ correlationId: 'conforme-follow-up:inq_1:1789732800000' }),
    );
  });

  it('does not enqueue when another path already claimed the reminder window', async () => {
    const tx = {
      opsInquiry: {
        updateMany: vi.fn(async () => ({ count: 0 })),
        findUniqueOrThrow: vi.fn(),
      },
      opsNotificationLog: {},
    };
    const writer = { write: vi.fn(async () => undefined) };

    await expect(claimConformeReminderWindow(tx as never, writer as never, {
      inquiryId: 'inq_1',
      conformeSentAt: new Date('2026-09-15T12:00:00.000Z'),
      expectedLastReminderAt: null,
      now: new Date('2026-09-24T12:00:00.000Z'),
      messages: [{ recipient: 'client@example.test', message: 'AI-approved copy', channel: 'email' }],
    })).rejects.toBeInstanceOf(ConflictException);
    expect(writer.write).not.toHaveBeenCalled();
  });

  it('allows exactly one concurrent caller to claim a reminder window', async () => {
    const inquiry = {
      id: 'inq_1',
      status: 'accepted',
      conformeSentAt: new Date('2026-09-15T12:00:00.000Z'),
      conformeSignedAt: null,
      lastConformeReminderAt: null as Date | null,
    };
    const tx = {
      opsInquiry: {
        updateMany: vi.fn(async ({ where, data }: any) => {
          if (
            inquiry.status !== where.status || inquiry.conformeSentAt.getTime() !== where.conformeSentAt.getTime() ||
            inquiry.conformeSignedAt !== where.conformeSignedAt || inquiry.lastConformeReminderAt !== where.lastConformeReminderAt
          ) return { count: 0 };
          Object.assign(inquiry, data);
          return { count: 1 };
        }),
        findUniqueOrThrow: vi.fn(async () => inquiry),
      },
    };
    const input = {
      inquiryId: 'inq_1',
      conformeSentAt: inquiry.conformeSentAt,
      expectedLastReminderAt: null,
      now: new Date('2026-09-24T12:00:00.000Z'),
    };

    const results = await Promise.allSettled([
      claimConformeReminderWindowState(tx as never, input),
      claimConformeReminderWindowState(tx as never, input),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(inquiry.lastConformeReminderAt).toEqual(input.now);
  });
});
