import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { AUDIT_WRITER, EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventLifecycleService, OpsUserRole } from '@prism/kernel/event-core';
import type { OpsEvent, OpsInquiry } from '@prisma/client';
import type { StartEventDayResult } from '@prism/types';
import { EventDayStartService } from './event-day-start.service';

const actor = { id: 'admin_1', name: 'PMCM', role: OpsUserRole.PmcmAdmin, email: 'admin@example.test', verified: true, explicit: true };

async function fixture() {
  const event: Pick<OpsEvent, 'id' | 'status' | 'readiness' | 'archived' | 'actualEndedAt' | 'clientPortalStatus' | 'floorPlanStatus'> & { inquiry: Pick<OpsInquiry, 'conformeSignedAt'> } = {
    id: 'evt_1', status: 'planning', readiness: 'Planning', archived: false, actualEndedAt: null,
    clientPortalStatus: 'unlocked', floorPlanStatus: 'approved', inquiry: { conformeSignedAt: new Date('2026-10-01T00:00:00Z') } };
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: event.id }]),
    opsEvent: { findUnique: vi.fn(async () => event), update: vi.fn(async ({ data }: { data: { status: string; readiness: string } }) => Object.assign(event, data)) },
  };
  const prisma = { $transaction: (work: (value: typeof tx) => Promise<StartEventDayResult>) => work(tx) };
  const access = { requireActorRole: vi.fn(async () => undefined), requireCanReadEvent: vi.fn(async () => undefined) };
  const audit = { write: vi.fn(async () => undefined) };
  const module = await Test.createTestingModule({ providers: [EventDayStartService, EventLifecycleService,
    { provide: PrismaService, useValue: prisma }, { provide: EventAccessPolicyService, useValue: access }, { provide: AUDIT_WRITER, useValue: audit }] }).compile();
  return { service: module.get(EventDayStartService), event, tx, access, audit };
}

describe('EventDayStartService', () => {
  it('starts a ready event and a retry neither rewrites it nor duplicates the audit', async () => {
    const f = await fixture();
    await expect(f.service.start('evt_1', actor)).resolves.toEqual({ eventId: 'evt_1', status: 'event_day' });
    expect(f.event.status).toBe('event_day');
    await f.service.start('evt_1', actor);
    expect(f.tx.opsEvent.update).toHaveBeenCalledTimes(1);
    expect(f.audit.write).toHaveBeenCalledTimes(1);
  });

  it.each(['locked', 'unsigned', 'unapproved', 'cancelled', 'ended'])('refuses %s events without a write', async (condition) => {
    const f = await fixture();
    if (condition === 'locked') f.event.clientPortalStatus = 'locked';
    if (condition === 'unsigned') f.event.inquiry.conformeSignedAt = null;
    if (condition === 'unapproved') f.event.floorPlanStatus = 'not_started';
    if (condition === 'cancelled') f.event.status = 'cancelled';
    if (condition === 'ended') f.event.actualEndedAt = new Date('2026-10-02T00:00:00Z');
    await expect(f.service.start('evt_1', actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(f.tx.opsEvent.update).not.toHaveBeenCalled();
    expect(f.audit.write).not.toHaveBeenCalled();
  });

  it('preserves a permission denial before reading or changing the event', async () => {
    const f = await fixture();
    f.access.requireActorRole.mockRejectedValueOnce(new ForbiddenException());
    await expect(f.service.start('evt_1', actor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.tx.opsEvent.findUnique).not.toHaveBeenCalled();
  });
});
