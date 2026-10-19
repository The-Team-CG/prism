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

  function correctionTransaction() {
    return {
      opsGuestRosterEntry: { findFirst: vi.fn(async (): Promise<{ id: string } | null> => null), updateMany: vi.fn(async () => ({ count: 1 })) },
      opsGuestCheckIn: { findFirst: vi.fn(async (): Promise<{ id: string } | null> => null), updateMany: vi.fn(async () => ({ count: 2 })) },
      opsGuestFeedback: { findFirst: vi.fn(async (): Promise<{ id: string } | null> => null), updateMany: vi.fn(async () => ({ count: 1 })) },
    };
  }

  it('corrects a guest name on roster, check-in, and feedback rows of the selected event only', async () => {
    const transaction = correctionTransaction();
    const result = await new OperationsPrivacyRedactorService().correctGuest(
      { eventId: 'event_1', name: ' Ana Reyes ', patch: { name: 'Ana R. Reyes', email: 'Ana.New@Example.test' } },
      transaction as never,
    );

    const subject = { eventId: 'event_1', guestName: { equals: 'Ana Reyes', mode: 'insensitive' } };
    expect(transaction.opsGuestRosterEntry.updateMany).toHaveBeenCalledWith({
      where: subject,
      data: { guestName: 'Ana R. Reyes', normalizedName: 'ana r. reyes', email: 'ana.new@example.test' },
    });
    expect(transaction.opsGuestCheckIn.updateMany).toHaveBeenCalledWith({ where: subject, data: { guestName: 'Ana R. Reyes' } });
    expect(transaction.opsGuestFeedback.updateMany).toHaveBeenCalledWith({ where: subject, data: { guestName: 'Ana R. Reyes' } });
    expect(result).toEqual({ surfaces: ['guest_roster_entry', 'guest_check_in', 'guest_feedback'], touchedRecords: 4 });
  });

  it('applies an email-only guest correction to roster rows alone', async () => {
    const transaction = correctionTransaction();
    const result = await new OperationsPrivacyRedactorService().correctGuest(
      { eventId: 'event_1', name: 'Ana Reyes', patch: { email: 'ana@example.test' } }, transaction as never,
    );

    expect(transaction.opsGuestRosterEntry.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { email: 'ana@example.test' } }));
    expect(transaction.opsGuestCheckIn.updateMany).not.toHaveBeenCalled();
    expect(transaction.opsGuestFeedback.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ surfaces: ['guest_roster_entry'], touchedRecords: 1 });
  });

  it('refuses a corrected name that would merge the subject into another guest of the same event', async () => {
    const transaction = correctionTransaction();
    transaction.opsGuestCheckIn.findFirst.mockResolvedValueOnce({ id: 'checkin_other' });

    await expect(new OperationsPrivacyRedactorService().correctGuest(
      { eventId: 'event_1', name: 'Ana Reyes', patch: { name: 'Ben Cruz' } }, transaction as never,
    )).rejects.toThrow('already uses the corrected name');
    expect(transaction.opsGuestRosterEntry.findFirst).toHaveBeenCalledWith({
      where: { eventId: 'event_1', guestName: { equals: 'Ben Cruz', mode: 'insensitive' } }, select: { id: true },
    });
    expect(transaction.opsGuestRosterEntry.updateMany).not.toHaveBeenCalled();
  });
});
