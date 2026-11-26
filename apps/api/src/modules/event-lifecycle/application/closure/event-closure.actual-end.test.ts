import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventClosureService } from './event-closure.service';

function harness(actualEndedAt: Date | null = null, actualStartedAt: Date | null = null) {
  const event = { id: 'evt_1', eventDate: new Date(Date.UTC(2026, 8, 7)), actualStartedAt, actualEndedAt, actualEndedBy: actualEndedAt ? 'old' : null, status: 'event_day', archived: false };
  const tx = { opsEvent: { findUnique: vi.fn(async () => event), update: vi.fn(async ({ data }: any) => ({ ...event, ...data })) }, opsEventWrapUp: { upsert: vi.fn(async ({ create }: any) => create) } };
  const prisma = { $transaction: vi.fn(async (fn: any) => fn(tx)) };
  const auditWriter = { write: vi.fn(async () => undefined) };
  const service = new EventClosureService(prisma as any, {} as any, {} as any, auditWriter as any, {} as any, {} as any, {} as any,
    { getLifecycleFacts: vi.fn() } as any, { getClosureFacts: vi.fn() } as any);
  return { service, tx, auditWriter };
}
const actor = { id: 'user_pmcm', name: 'Maxine', email: 'mys@test', role: OpsUserRole.PmcmAdmin } as any;

describe('EventClosureService actual end', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('records a past actual end and audits the verified actor', async () => {
    const { service, tx, auditWriter } = harness();
    await service.recordActualEventEnd('evt_1', { actualEndedAt: '2026-09-07T12:00:00.000Z' }, actor);
    expect(tx.opsEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actualEndedBy: 'user_pmcm' }) }));
    expect(auditWriter.write).toHaveBeenCalled();
  });
  it('refuses an end before the event could have run, and accepts an early start, a late Start click or a reasoned correction', async () => {
    // Event day of 2026-09-07 (it begins 2026-09-06T16:00Z in Manila), started early in the system on the 5th.
    const early = harness(null, new Date(Date.UTC(2026, 8, 5, 8)));
    await expect(early.service.recordActualEventEnd('evt_1', { actualEndedAt: '2026-09-05T10:00:00.000Z' }, actor)).resolves.toBeDefined();

    const started = harness(null, new Date(Date.UTC(2026, 8, 7, 1)));
    // Before the date and more than 12 hours before Start was pressed: not a time the event ran.
    await expect(started.service.recordActualEventEnd('evt_1', { actualEndedAt: '2026-09-04T12:00:00.000Z' }, actor)).rejects.toThrow('before onsite started');
    expect(started.tx.opsEvent.update).not.toHaveBeenCalled();
    // Start pressed late, after the event had begun: an end a few hours earlier is still accepted.
    await expect(started.service.recordActualEventEnd('evt_1', { actualEndedAt: '2026-09-06T22:00:00.000Z' }, actor)).resolves.toBeDefined();
    // PMCM can still set any past end with a reason; the correction is audited.
    const corrected = harness(new Date(Date.UTC(2026, 8, 7, 12)), new Date(Date.UTC(2026, 8, 7, 1)));
    await expect(corrected.service.recordActualEventEnd('evt_1', { actualEndedAt: '2026-08-30T12:00:00.000Z', correctionReason: 'Feedback window test' }, actor)).resolves.toBeDefined();

    // No recorded start (an event that started before it was kept): nothing to check against.
    await expect(harness().service.recordActualEventEnd('evt_1', { actualEndedAt: '2026-09-04T12:00:00.000Z' }, actor)).resolves.toBeDefined();
  });

  it('rejects future timestamps', async () => {
    const { service } = harness();
    await expect(service.recordActualEventEnd('evt_1', { actualEndedAt: '2999-01-01T00:00:00.000Z' }, actor)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('requires a reason for corrections and records the new value', async () => {
    const { service, auditWriter } = harness(new Date('2026-09-07T12:00:00.000Z'));
    await expect(service.recordActualEventEnd('evt_1', { actualEndedAt: '2026-09-07T13:00:00.000Z' }, actor)).rejects.toBeInstanceOf(BadRequestException);
    await service.recordActualEventEnd('evt_1', { actualEndedAt: '2026-09-07T13:00:00.000Z', correctionReason: 'Verified venue log' }, actor);
    expect(auditWriter.write).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ correctionReason: 'Verified venue log' }) }), expect.anything());
  });
  it('accepts an idempotent same-timestamp correction', async () => {
    const { service, tx, auditWriter } = harness(new Date('2026-09-07T12:00:00.000Z'));
    await service.recordActualEventEnd('evt_1', { actualEndedAt: '2026-09-07T12:00:00.000Z' }, actor);
    expect(tx.opsEvent.update).toHaveBeenCalledTimes(1);
    expect(auditWriter.write).not.toHaveBeenCalled();
  });
});
