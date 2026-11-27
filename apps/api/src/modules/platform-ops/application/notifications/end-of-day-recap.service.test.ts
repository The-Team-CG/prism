import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { EndOfDayRecapService, recapWindow } from './end-of-day-recap.service';

// 2026-11-27 18:05 in Manila is 10:05 UTC.
const afterSendTime = new Date('2026-11-27T10:05:00.000Z');

function fixture(rows: Array<{ eventId: string | null; actor: string; action: string; category: string; createdAt: Date }>) {
  const findMany = vi.fn(async (_args: unknown) => rows);
  const write = vi.fn(async (_input: { recipient: string; message: string; channel?: string; idempotencyKey?: string }) => undefined);
  const contacts = { findEventNames: vi.fn(async () => ({ evt_gala: 'Ayala Gala', evt_launch: 'Product Launch' })) };
  const service = new EndOfDayRecapService({ opsAuditLog: { findMany } } as never, contacts as never, { write } as never);
  return { service, findMany, write };
}

describe('EndOfDayRecapService (UAT 7.5)', () => {
  it('emails the PMCM admins one recap of the day once 18:00 Philippine time has passed', async () => {
    const { service, findMany, write } = fixture([
      { eventId: 'evt_gala', actor: 'Ana', action: 'Approved billing source: Downpayment', category: 'finance', createdAt: new Date('2026-11-27T01:00:00.000Z') },
      { eventId: 'evt_gala', actor: 'Ana', action: 'Published floor plan', category: 'events', createdAt: new Date('2026-11-27T03:30:00.000Z') },
      { eventId: 'evt_launch', actor: 'Ben', action: 'Logged onsite issue', category: 'events', createdAt: new Date('2026-11-27T05:00:00.000Z') },
    ]);

    await expect(service.queueRecap(afterSendTime)).resolves.toEqual({ status: 'queued', day: '2026-11-27', actions: 3 });

    // The window is the Philippine day from midnight to the 18:00 send time.
    expect(findMany.mock.calls[0]![0]).toMatchObject({ where: { createdAt: { gte: new Date('2026-11-26T16:00:00.000Z'), lt: new Date('2026-11-27T10:00:00.000Z') } } });
    expect(write).toHaveBeenCalledOnce();
    const notice = write.mock.calls[0]![0];
    expect(notice).toMatchObject({ recipient: 'PMCM Admin', channel: 'email', idempotencyKey: 'end-of-day-recap:2026-11-27' });
    expect(notice.message.split('\n')[0]).toBe('End-of-day recap for 2026-11-27.');
    expect(notice.message).toContain('3 updates across 2 events today.');
    expect(notice.message).toContain('By area: Events 2 · Finance 1.');
    expect(notice.message).toContain('- Ayala Gala: 2 updates');
    // Latest first, in Philippine time, with the event named.
    expect(notice.message).toContain('Latest activity:\n- 13:00 Ben: Logged onsite issue (Product Launch)');
  });

  it('sends nothing before 18:00, nothing on a quiet day, and no second recap for the same day', async () => {
    const quiet = fixture([]);
    await expect(quiet.service.queueRecap(new Date('2026-11-27T09:59:00.000Z'))).resolves.toMatchObject({ status: 'skipped', reason: 'before_send_time' });
    await expect(quiet.service.queueRecap(afterSendTime)).resolves.toMatchObject({ status: 'skipped', reason: 'no_activity' });
    expect(quiet.write).not.toHaveBeenCalled();

    const repeat = fixture([{ eventId: null, actor: 'Ana', action: 'Signed in', category: 'access', createdAt: new Date('2026-11-27T01:00:00.000Z') }]);
    repeat.write.mockRejectedValueOnce(new ConflictException('duplicate'));
    await expect(repeat.service.queueRecap(afterSendTime)).resolves.toMatchObject({ status: 'skipped', reason: 'already_queued' });
  });

  it('uses the Philippine calendar day for the window', () => {
    expect(recapWindow('2026-11-27')).toEqual({ from: new Date('2026-11-26T16:00:00.000Z'), to: new Date('2026-11-27T10:00:00.000Z') });
  });
});
