import { describe, expect, it, vi } from 'vitest';
import type { PlatformRetentionCandidate } from '@prism/contexts/read-models';
import { PrivacyRetentionExecutorService } from './privacy-retention-executor.service';

function createExecutor() {
  const lifecycle = {
    redactClient: vi.fn(async () => ({ inquiryIds: ['inq_a'], eventIds: ['evt_a'], surfaces: ['inquiry'], touchedRecords: 1 })),
  };
  const commercial = {
    redactClientBilling: vi.fn(async () => ({ surfaces: ['billing_contact'], touchedRecords: 2 })),
  };
  const operations = {
    redactGuest: vi.fn(async () => ({ surfaces: ['guest_check_in'], touchedRecords: 3 })),
    redactGuestRecord: vi.fn(async () => ({ surfaces: ['guest_feedback'], touchedRecords: 2, storedObjectIds: ['obj_photo'] })),
  };
  const triage = {
    eraseForInquiries: vi.fn(async (ids: readonly string[]) => (ids.length ? { surfaces: ['ai_triage'], touchedRecords: 1 } : { surfaces: [], touchedRecords: 0 })),
  };
  const storage = { eraseGuestFeedbackMedia: vi.fn(async (ids: string[]) => ids.length) };
  const executor = new PrivacyRetentionExecutorService(lifecycle as never, commercial as never, operations as never, triage as never, storage as never);
  return { executor, lifecycle, commercial, operations, triage, storage };
}

describe('PrivacyRetentionExecutorService', () => {
  it('redacts an inquiry only for its own event, using the owner redactors, and reports their counts', async () => {
    const { executor, lifecycle, commercial, operations, triage } = createExecutor();
    const candidate: PlatformRetentionCandidate = {
      category: 'inquiry', subjectId: 'inq_a', eventId: 'evt_a', subjectEmail: ' Ana@Ayala.TEST ', subjectName: '', anchorAt: new Date('2025-01-01T00:00:00.000Z'),
    };

    const result = await executor.redactCandidate(candidate, 'retention_1', {} as never);

    expect(lifecycle.redactClient).toHaveBeenCalledWith(
      { email: 'ana@ayala.test', redactedEmail: 'redacted+retention_retention_1@privacy.local', eventId: 'evt_a' },
      expect.anything(),
    );
    expect(commercial.redactClientBilling).toHaveBeenCalledWith({ eventIds: ['evt_a'], redactedEmail: 'redacted+retention_retention_1@privacy.local' }, expect.anything());
    expect(operations.redactGuest).not.toHaveBeenCalled();
    expect(triage.eraseForInquiries).toHaveBeenCalledWith(['inq_a'], expect.anything());
    expect(result).toEqual({ surfaces: ['inquiry', 'billing_contact', 'ai_triage'], touchedRecords: 4 });
  });

  it('redacts a guest record by id inside its event and deletes its stored media', async () => {
    const { executor, lifecycle, operations, storage } = createExecutor();
    const candidate: PlatformRetentionCandidate = {
      category: 'guest_feedback', subjectId: 'fb_1', eventId: 'evt_gala', subjectEmail: '', subjectName: 'Ana Reyes', anchorAt: new Date('2025-01-01T00:00:00.000Z'),
    };

    const result = await executor.redactCandidate(candidate, 'retention_2', {} as never);

    // Targets only the referenced record by id; a name-based call would also redact a different guest with the same name.
    expect(operations.redactGuestRecord).toHaveBeenCalledWith({ eventId: 'evt_gala', recordType: 'guest_feedback', recordId: 'fb_1' }, expect.anything());
    expect(operations.redactGuest).not.toHaveBeenCalled();
    expect(lifecycle.redactClient).not.toHaveBeenCalled();
    expect(storage.eraseGuestFeedbackMedia).toHaveBeenCalledWith(['obj_photo'], expect.anything());
    expect(result).toEqual({ surfaces: ['guest_feedback', 'guest_feedback_media'], touchedRecords: 3 });
  });
});
