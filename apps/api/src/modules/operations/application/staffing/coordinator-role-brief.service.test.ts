import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { CoordinatorRoleBriefService } from './coordinator-role-brief.service';

const pmcm = { id: 'usr-pmcm', role: OpsUserRole.PmcmAdmin, name: 'PMCM', email: 'pmcm@test', explicit: true, verified: true };
const floorDirector = { id: 'usr-fd', role: OpsUserRole.Coordinator, name: 'Floor Director', email: 'fd@test', explicit: true, verified: true };
const client = { id: 'usr-client', role: OpsUserRole.Client, name: 'Client', email: 'client@test', explicit: true, verified: true };

function fixture(assignment: { role: string; status: string } | null = { role: 'Floor Director', status: 'acknowledged' }) {
  const rows: Array<Record<string, unknown>> = [];
  const key = (where: { eventId_role: { eventId: string; role: string } }) => (row: Record<string, unknown>) =>
    row.eventId === where.eventId_role.eventId && row.role === where.eventId_role.role;
  const db = {
    opsCoordinatorRoleBrief: {
      findMany: vi.fn(async () => rows),
      findUnique: vi.fn(async ({ where }: { where: { eventId_role: { eventId: string; role: string } } }) => rows.find(key(where)) ?? null),
      upsert: vi.fn(async ({ where, create, update }: { where: { eventId_role: { eventId: string; role: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const existing = rows.find(key(where));
        if (existing) return Object.assign(existing, update, { updatedAt: new Date() });
        const row = { ...create, updatedAt: new Date() };
        rows.push(row);
        return row;
      }),
    },
  };
  const prisma = { ...db, $transaction: vi.fn(async (fn: (value: typeof db) => unknown) => fn(db)) };
  const staffing = { findAssignmentForEventActor: vi.fn(async () => assignment) };
  const events = { findOperationsEvent: vi.fn(async () => ({ id: 'evt-1', archived: false })) };
  const service = new CoordinatorRoleBriefService(prisma as never, { write: vi.fn() } as never, staffing as never, events as never);
  return { service, rows };
}

const brief = { callTime: '2026-12-01T06:00:00+08:00', attire: 'Black formal', script: 'Opening cue at 6:30.', instructions: 'Hold the stage door.' };

describe('CoordinatorRoleBriefService', () => {
  it('lets PMCM write one brief per role and shows an assigned coordinator only the brief for their own role', async () => {
    const f = fixture();
    await f.service.upsert('evt-1', 'Floor Director', brief, pmcm);
    await f.service.upsert('evt-1', 'Stage Director', { ...brief, attire: 'Stage blacks' }, pmcm);
    await f.service.upsert('evt-1', 'Floor Director', { ...brief, attire: 'Barong' }, pmcm);

    expect(f.rows).toHaveLength(2);
    await expect(f.service.list('evt-1', pmcm)).resolves.toHaveLength(2);
    const own = await f.service.list('evt-1', floorDirector);
    expect(own).toEqual([expect.objectContaining({ role: 'Floor Director', attire: 'Barong', callTime: '2026-11-30T22:00:00.000Z' })]);
  });

  it('refuses clients and coordinators who are not actively assigned to the event', async () => {
    await expect(fixture().service.list('evt-1', client)).rejects.toThrow(ForbiddenException);
    await expect(fixture(null).service.list('evt-1', floorDirector)).rejects.toThrow(ForbiddenException);
    await expect(fixture({ role: 'Floor Director', status: 'declined' }).service.list('evt-1', floorDirector)).rejects.toThrow(ForbiddenException);
  });
});
