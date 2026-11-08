import { describe, expect, it, vi } from 'vitest';
import { InquiryDraftService } from './inquiry-draft.service';

describe('FR-50 inquiry drafts', () => {
  it('reminds once for a draft left idle a day, never without an email, and purges drafts after 30 days', async () => {
    const now = new Date('2026-11-10T12:00:00.000Z');
    const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
    const drafts = [
      { id: 'idle', email: 'ana@test', remindedAt: null as Date | null, updatedAt: hoursAgo(30), payload: {} },
      { id: 'fresh', email: 'ben@test', remindedAt: null as Date | null, updatedAt: hoursAgo(2), payload: {} },
      { id: 'anonymous', email: null, remindedAt: null as Date | null, updatedAt: hoursAgo(30), payload: {} },
      { id: 'stale', email: 'cy@test', remindedAt: hoursAgo(700), updatedAt: hoursAgo(24 * 31), payload: {} },
    ];
    const prisma = { opsInquiryDraft: {
      findMany: vi.fn(async ({ where }: { where: { updatedAt: { lte: Date } } }) => drafts.filter((draft) => draft.email && !draft.remindedAt && draft.updatedAt <= where.updatedAt.lte)),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { remindedAt: Date } }) => Object.assign(drafts.find((draft) => draft.id === where.id)!, data)),
      deleteMany: vi.fn(async ({ where }: { where: { updatedAt: { lte: Date } } }) => {
        const removed = drafts.filter((draft) => draft.updatedAt <= where.updatedAt.lte);
        for (const draft of removed) drafts.splice(drafts.indexOf(draft), 1);
        return { count: removed.length };
      }),
    } };
    const outbox = { write: vi.fn(async (_entry: Record<string, unknown>) => undefined) };
    const service = new InquiryDraftService(prisma as never, outbox as never, { client: 'https://client.example.test', supplier: '', event: '' });

    expect(await service.sweep(now)).toEqual({ reminded: 1, purged: 1 });
    expect(outbox.write).toHaveBeenCalledTimes(1);
    expect(outbox.write.mock.calls[0]?.[0]).toMatchObject({ recipient: 'ana@test', message: expect.stringContaining('https://client.example.test/inquiry?draft=idle') });
    expect(await service.sweep(now)).toEqual({ reminded: 0, purged: 0 });
    expect(drafts.map((draft) => draft.id)).toEqual(['idle', 'fresh', 'anonymous']);
  });
});
