import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { LogisticsBookingService } from './logistics-booking.service';

const pmcm = { id: 'usr_pmcm', role: OpsUserRole.PmcmAdmin, name: 'Maxine', email: 'pmcm@test', explicit: true, verified: true };

function fixture() {
  const sources: Array<Record<string, unknown>> = [];
  const bookings: Array<Record<string, unknown>> = [];
  const tx = {
    opsBillingSource: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { sources.push(data); return data; }) },
    opsLogisticsBooking: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const row = { ...data, createdAt: new Date() }; bookings.push(row); return row; }) },
  };
  const prisma = { ...tx, opsEvent: { findUnique: vi.fn(async () => ({ id: 'evt_1' })) }, $transaction: vi.fn(async (run: (client: unknown) => unknown) => run(tx)) };
  const access = { requireActorRole: vi.fn(async (actor: { role: string }, roles: string[]) => { if (!roles.includes(actor.role)) throw new ForbiddenException('no'); }) };
  const service = new LogisticsBookingService(prisma as never, access as never, { write: vi.fn(async () => undefined) } as never);
  return { service, sources, bookings };
}

describe('New-P4 logistics bookings', () => {
  it('raises a draft logistics billing source for a priced booking and none for a free one', async () => {
    const f = fixture();
    const priced = await f.service.create('evt_1', { provider: 'lalamove', bookingReference: 'LLM-123', description: 'Return backdrop panels', amount: 1800 }, pmcm);
    expect(f.sources).toEqual([expect.objectContaining({ sourceType: 'logistics', status: 'draft', totalAmount: 1800, sourceLabel: expect.stringContaining('Lalamove LLM-123') })]);
    expect(priced.billingSourceId).toBe(f.sources[0]!.id);

    const free = await f.service.create('evt_1', { provider: 'grab', bookingReference: 'GRB-9', description: 'Client picked up', amount: 0 }, pmcm);
    expect(free.billingSourceId).toBeNull();
    expect(f.sources).toHaveLength(1);
    await expect(f.service.create('evt_1', { provider: 'grab', bookingReference: 'X', description: 'Y', amount: 1 }, { ...pmcm, role: OpsUserRole.Client })).rejects.toThrow(ForbiddenException);
  });
});
