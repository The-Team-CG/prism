import { describe, expect, it, vi } from 'vitest';
import { OperationsPrivacyRedactorService } from './operations-privacy-redactor.service';

describe('OperationsPrivacyRedactorService', () => {
  it('redacts guest roster identity and feedback filename metadata without touching file bytes', async () => {
    const rosterUpdate = vi.fn(async () => undefined);
    const mediaUpdate = vi.fn(async () => ({ count: 2 }));
    const transaction = {
      opsGuestRosterEntry: {
        findMany: vi.fn(async () => [{ id: 'roster_1' }]),
        findFirst: vi.fn(async () => null),
        update: rosterUpdate,
      },
      opsGuestCheckIn: { updateMany: vi.fn(async () => ({ count: 1 })) },
      opsGuestFeedback: {
        findMany: vi.fn(async () => [{ id: 'feedback_1' }]),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      opsGuestFeedbackMedia: { updateMany: mediaUpdate },
    };

    const result = await new OperationsPrivacyRedactorService().redactGuest(
      { eventId: 'event_1', name: 'Ana Reyes' }, transaction as never,
    );

    expect(rosterUpdate).toHaveBeenCalledWith({
      where: { id: 'roster_1' },
      data: {
        sourceKey: 'privacy-redacted:roster_1', guestName: 'Redacted guest', normalizedName: 'redacted guest', email: '', phone: '',
      },
    });
    expect(mediaUpdate).toHaveBeenCalledWith({
      where: { feedbackId: { in: ['feedback_1'] } },
      data: { originalFileName: '[redacted by privacy request]' },
    });
    expect(result).toEqual({
      surfaces: ['guest_roster_entry', 'guest_check_in', 'guest_feedback', 'guest_feedback_media_metadata'],
      touchedRecords: 5,
    });
  });

  it('uses a bounded suffix when the base redacted source key already exists in the event', async () => {
    const rosterUpdate = vi.fn(async () => undefined);
    const findFirst = vi.fn(async ({ where }: { where: { sourceKey: string } }) =>
      where.sourceKey === 'privacy-redacted:roster_1' ? { id: 'existing_import' } : null);
    const transaction = {
      opsGuestRosterEntry: {
        findMany: vi.fn(async () => [{ id: 'roster_1' }]),
        findFirst,
        update: rosterUpdate,
      },
      opsGuestCheckIn: { updateMany: vi.fn(async () => ({ count: 0 })) },
      opsGuestFeedback: { findMany: vi.fn(async () => []), updateMany: vi.fn(async () => ({ count: 0 })) },
      opsGuestFeedbackMedia: { updateMany: vi.fn() },
    };

    await new OperationsPrivacyRedactorService().redactGuest(
      { eventId: 'event_1', name: 'Ana Reyes' }, transaction as never,
    );

    expect(findFirst).toHaveBeenNthCalledWith(1, {
      where: { eventId: 'event_1', sourceKey: 'privacy-redacted:roster_1' }, select: { id: true },
    });
    expect(rosterUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sourceKey: 'privacy-redacted:roster_1:1' }),
    }));
  });

  it('does not query or mutate media metadata when no matching feedback exists', async () => {
    const mediaUpdate = vi.fn();
    const transaction = {
      opsGuestRosterEntry: { findMany: vi.fn(async () => []), findFirst: vi.fn(), update: vi.fn() },
      opsGuestCheckIn: { updateMany: vi.fn(async () => ({ count: 0 })) },
      opsGuestFeedback: { findMany: vi.fn(async () => []), updateMany: vi.fn(async () => ({ count: 0 })) },
      opsGuestFeedbackMedia: { updateMany: mediaUpdate },
    };

    const result = await new OperationsPrivacyRedactorService().redactGuest(
      { eventId: 'event_1', name: 'Missing guest' }, transaction as never,
    );

    expect(mediaUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({ surfaces: [], touchedRecords: 0 });
  });
});
