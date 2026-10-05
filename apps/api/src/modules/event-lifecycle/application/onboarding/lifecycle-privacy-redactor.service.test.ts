import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { LifecyclePrivacyRedactorService } from './lifecycle-privacy-redactor.service';

describe('LifecyclePrivacyRedactorService', () => {
  it('limits linked event redaction to the requested event when the inquiry spans multiple events', async () => {
    const transaction = {
      opsInquiry: {
        findMany: vi.fn(async () => [{ id: 'inquiry_1' }]),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      opsEvent: {
        findMany: vi.fn(async () => [{ id: 'event_a' }]),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
    };

    const result = await new LifecyclePrivacyRedactorService().redactClient(
      { email: 'ana@example.test', redactedEmail: 'redacted@example.test', eventId: 'event_a' },
      transaction as unknown as Prisma.TransactionClient,
    );

    expect(transaction.opsEvent.findMany).toHaveBeenCalledWith({
      where: { inquiryId: { in: ['inquiry_1'] }, id: 'event_a' },
      select: { id: true },
    });
    expect(transaction.opsEvent.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['event_a'] } },
      data: { clientName: 'Redacted data subject' },
    });
    expect(result.eventIds).toEqual(['event_a']);
    expect(result.touchedRecords).toBe(2);
  });
});
