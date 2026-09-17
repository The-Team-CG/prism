import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventClosureService } from './event-closure.service';

function harness(actualEndedAt: Date | null = null) {
  const event = { id: 'evt_1', actualEndedAt, actualEndedBy: actualEndedAt ? 'old' : null, status: 'event_day', archived: false };
  const tx = { opsEvent: { findUnique: vi.fn(async () => event), update: vi.fn(async ({ data }: any) => ({ ...event, ...data })) }, opsEventWrapUp: { upsert: vi.fn(async ({ create }: any) => create) } };
  const prisma = { $transaction: vi.fn(async (fn: any) => fn(tx)) };
  const auditWriter = { write: vi.fn(async () => undefined) };
  const service = new EventClosureService(prisma as any, {} as any, {} as any, auditWriter as any, {} as any, {} as any, {} as any);
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
