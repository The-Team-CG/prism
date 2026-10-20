import { describe, expect, it, vi } from 'vitest';
import { PlatformRetentionReadModelsService } from './platform-retention-read-models.service';

const archivedBefore = new Date('2026-01-01T00:00:00.000Z');
const archivedAt = new Date('2025-06-01T00:00:00.000Z');

function createService(data: {
  events: Array<{ id: string; archived?: boolean; archivedAt: Date | null; inquiry: { id: string; email: string; clientName: string } | null }>;
  checkIns?: Array<{ id: string; eventId: string; guestName: string | null }>;
  feedback?: Array<{ id: string; eventId: string; guestName: string | null }>;
}) {
  const prisma = {
    opsEvent: {
      findMany: vi.fn(async ({ take }: { take: number }) => data.events.filter((event) => event.archived !== false && event.archivedAt).slice(0, take)),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => data.events.find((event) => event.id === where.id) ?? null),
    },
    opsGuestCheckIn: {
      findMany: vi.fn(async () => data.checkIns ?? []),
      findFirst: vi.fn(async () => (data.checkIns ?? [])[0] ?? null),
    },
    opsGuestFeedback: {
      findMany: vi.fn(async () => data.feedback ?? []),
      findFirst: vi.fn(async () => (data.feedback ?? [])[0] ?? null),
    },
  };
  return { service: new PlatformRetentionReadModelsService(prisma as never), prisma };
}

describe('PlatformRetentionReadModelsService', () => {
  it('lists inquiry candidates only for archived events past the cutoff and skips rows already redacted', async () => {
    const { service } = createService({
      events: [
        { id: 'evt_a', archivedAt, inquiry: { id: 'inq_a', email: 'ana@ayala.test', clientName: 'Ana' } },
        { id: 'evt_b', archivedAt, inquiry: { id: 'inq_b', email: 'redacted+x@privacy.local', clientName: 'Redacted data subject' } },
        { id: 'evt_c', archivedAt: null, inquiry: { id: 'inq_c', email: 'c@test.dev', clientName: 'C' } },
      ],
    });

    const page = await service.findRetentionCandidates({ category: 'inquiry', archivedBefore, eventTake: 50 });

    expect(page.candidates).toEqual([
      { category: 'inquiry', subjectId: 'inq_a', eventId: 'evt_a', subjectEmail: 'ana@ayala.test', subjectName: '', anchorAt: archivedAt },
    ]);
    expect(page.nextEventCursor).toBeNull();
  });

  it('returns a cursor while the event page is full so the sweep can continue without skipping events', async () => {
    const { service } = createService({
      events: [
        { id: 'evt_a', archivedAt, inquiry: { id: 'inq_a', email: 'a@test.dev', clientName: 'A' } },
        { id: 'evt_b', archivedAt, inquiry: { id: 'inq_b', email: 'b@test.dev', clientName: 'B' } },
      ],
    });

    const page = await service.findRetentionCandidates({ category: 'inquiry', archivedBefore, eventTake: 2 });

    expect(page.nextEventCursor).toBe('evt_b');
  });

  it('lists guest check-ins and feedback by name for archived events and excludes names already redacted', async () => {
    const { service } = createService({
      events: [{ id: 'evt_gala', archivedAt, inquiry: null }],
      checkIns: [
        { id: 'chk_1', eventId: 'evt_gala', guestName: 'Ana Reyes' },
        { id: 'chk_2', eventId: 'evt_gala', guestName: null },
      ],
      feedback: [{ id: 'fb_1', eventId: 'evt_gala', guestName: 'Bo Lim' }],
    });

    const checkIns = await service.findRetentionCandidates({ category: 'guest_check_in', archivedBefore, eventTake: 50 });
    const feedback = await service.findRetentionCandidates({ category: 'guest_feedback', archivedBefore, eventTake: 50 });

    expect(checkIns.candidates.map((candidate) => [candidate.subjectId, candidate.subjectName])).toEqual([['chk_1', 'Ana Reyes']]);
    expect(feedback.candidates.map((candidate) => [candidate.subjectId, candidate.subjectName])).toEqual([['fb_1', 'Bo Lim']]);
  });

  it('re-reads one subject for execution and returns null once it is no longer an archived candidate', async () => {
    const { service } = createService({
      events: [{ id: 'evt_a', archived: true, archivedAt, inquiry: { id: 'inq_a', email: 'ana@ayala.test', clientName: 'Ana' } }],
    });

    await expect(service.findRetentionCandidate({ category: 'inquiry', subjectId: 'inq_a', eventId: 'evt_a' })).resolves.toMatchObject({ subjectId: 'inq_a' });
    await expect(service.findRetentionCandidate({ category: 'inquiry', subjectId: 'inq_other', eventId: 'evt_a' })).resolves.toBeNull();
    await expect(service.findRetentionCandidate({ category: 'inquiry', subjectId: 'inq_a', eventId: 'evt_missing' })).resolves.toBeNull();
  });
});
