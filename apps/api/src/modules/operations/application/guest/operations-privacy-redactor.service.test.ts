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

  describe('record-id redaction', () => {
    type Row = Record<string, unknown>;
    const matches = (row: Row, where: Record<string, unknown>) =>
      Object.entries(where).every(([key, expected]) => {
        if (expected && typeof expected === 'object' && 'in' in expected) return (expected as { in: unknown[] }).in.includes(row[key]);
        return row[key] === expected;
      });

    /** Two guests named "Ana Reyes" in the same event, each with a roster entry, plus media on one feedback item. */
    function createGuestStore() {
      const checkIns: Row[] = [
        { id: 'chk_1', eventId: 'event_1', guestName: 'Ana Reyes', rosterEntryId: 'roster_1' },
        { id: 'chk_2', eventId: 'event_1', guestName: 'Ana Reyes', rosterEntryId: 'roster_2' },
      ];
      const roster: Row[] = [
        { id: 'roster_1', eventId: 'event_1', sourceKey: 'import-1', guestName: 'Ana Reyes', normalizedName: 'ana reyes', email: 'ana1@x.test', phone: '1' },
        { id: 'roster_2', eventId: 'event_1', sourceKey: 'import-2', guestName: 'Ana Reyes', normalizedName: 'ana reyes', email: 'ana2@x.test', phone: '2' },
      ];
      const feedback: Row[] = [
        { id: 'fb_1', eventId: 'event_1', guestName: 'Ana Reyes', comment: 'Lovely', photoFileName: 'a.jpg', videoFileName: null },
        { id: 'fb_2', eventId: 'event_1', guestName: 'Ana Reyes', comment: 'Great', photoFileName: 'b.jpg', videoFileName: null },
      ];
      const media: Row[] = [
        { id: 'm_1', feedbackId: 'fb_1', originalFileName: 'a-original.jpg' },
        { id: 'm_2', feedbackId: 'fb_2', originalFileName: 'b-original.jpg' },
      ];
      const table = (rows: Row[]) => ({
        findFirst: vi.fn(async ({ where }: { where: Row }) => rows.find((row) => matches(row, where)) ?? null),
        findMany: vi.fn(async ({ where }: { where: Row }) => rows.filter((row) => matches(row, where))),
        updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
          const hit = rows.filter((row) => matches(row, where));
          hit.forEach((row) => Object.assign(row, data));
          return { count: hit.length };
        }),
        update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
          rows.filter((row) => matches(row, where)).forEach((row) => Object.assign(row, data));
          return null;
        }),
      });
      const transaction = {
        opsGuestCheckIn: table(checkIns),
        opsGuestRosterEntry: table(roster),
        opsGuestFeedback: table(feedback),
        opsGuestFeedbackMedia: table(media),
      };
      return { transaction, checkIns, roster, feedback, media };
    }

    it('redacts only the referenced check-in and its roster entry, leaving a same-named guest in the event untouched', async () => {
      const store = createGuestStore();

      const result = await new OperationsPrivacyRedactorService().redactGuestRecord(
        { eventId: 'event_1', recordType: 'guest_check_in', recordId: 'chk_1' }, store.transaction as never,
      );

      expect(store.checkIns.find((row) => row.id === 'chk_1')?.guestName).toBe('Redacted guest');
      expect(store.roster.find((row) => row.id === 'roster_1')).toMatchObject({ guestName: 'Redacted guest', email: '', phone: '' });
      expect(store.checkIns.find((row) => row.id === 'chk_2')).toMatchObject({ guestName: 'Ana Reyes' });
      expect(store.roster.find((row) => row.id === 'roster_2')).toMatchObject({ guestName: 'Ana Reyes', email: 'ana2@x.test', phone: '2' });
      expect(result).toEqual({ surfaces: ['guest_roster_entry', 'guest_check_in'], touchedRecords: 2 });
    });

    it('redacts only the referenced feedback item and its own media metadata, leaving a same-named guest untouched', async () => {
      const store = createGuestStore();

      const result = await new OperationsPrivacyRedactorService().redactGuestRecord(
        { eventId: 'event_1', recordType: 'guest_feedback', recordId: 'fb_1' }, store.transaction as never,
      );

      expect(store.feedback.find((row) => row.id === 'fb_1')).toMatchObject({ guestName: 'Redacted guest', comment: '[redacted by privacy request]', photoFileName: null });
      expect(store.media.find((row) => row.id === 'm_1')?.originalFileName).toBe('[redacted by privacy request]');
      expect(store.feedback.find((row) => row.id === 'fb_2')).toMatchObject({ guestName: 'Ana Reyes', comment: 'Great', photoFileName: 'b.jpg' });
      expect(store.media.find((row) => row.id === 'm_2')?.originalFileName).toBe('b-original.jpg');
      expect(result).toEqual({ surfaces: ['guest_feedback_media_metadata', 'guest_feedback'], touchedRecords: 2 });
    });

    it('does nothing when the record does not belong to the event', async () => {
      const store = createGuestStore();

      const result = await new OperationsPrivacyRedactorService().redactGuestRecord(
        { eventId: 'event_other', recordType: 'guest_check_in', recordId: 'chk_1' }, store.transaction as never,
      );

      expect(store.checkIns.find((row) => row.id === 'chk_1')?.guestName).toBe('Ana Reyes');
      expect(result).toEqual({ surfaces: [], touchedRecords: 0 });
    });
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
