import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { VenueScoutingService } from './venue-scouting.service';

const pmcm = { id: 'usr_pmcm', role: OpsUserRole.PmcmAdmin, name: 'Maxine', email: 'pmcm@test', explicit: true, verified: true };
const client = { id: 'usr_client', role: OpsUserRole.Client, name: 'Ana', email: 'ana@test', explicit: true, verified: true };
const otherContact = { ...client, id: 'usr_other', email: 'other@test' };

type Row = Record<string, unknown> & { id: string; status: string; clientPreferredAt: Date | null };

function matches(row: Row, where: Record<string, unknown>) {
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object' && 'in' in value) return (value.in as unknown[]).includes(row[key]);
    if (value && typeof value === 'object' && 'not' in value) return row[key] !== value.not;
    return row[key] === value;
  });
}

function fixture() {
  const rows: Row[] = [];
  const table = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = { status: 'draft', clientPreferredAt: null, clientPreferenceNote: '', notes: '', createdAt: new Date(), ...data } as Row;
      rows.push(row);
      return row;
    }),
    count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.filter((row) => matches(row, where)).length),
    findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.filter((row) => matches(row, where))),
    findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.find((row) => matches(row, where)) ?? null),
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const hit = rows.filter((row) => matches(row, where));
      for (const row of hit) Object.assign(row, data);
      return { count: hit.length };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(rows.find((row) => row.id === where.id)!, data)),
  };
  const prisma = { opsVenueScoutingOption: table, $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run(prisma)) };
  const access = {
    requireActorRole: vi.fn(async (actor: { role: string }, roles: string[]) => { if (!roles.includes(actor.role)) throw new ForbiddenException('no'); }),
    requireCanReadEvent: vi.fn(async () => undefined),
  };
  const events = {
    findOperationsEvent: vi.fn(async () => ({ id: 'evt_1', archived: false })),
    findEventReadAccess: vi.fn(async () => ({ id: 'evt_1', clientPortalStatus: 'unlocked', inquiry: { email: 'ana@test' } })),
  };
  const service = new VenueScoutingService(prisma as never, access as never, { write: vi.fn(async () => undefined) } as never, events as never);
  const add = (name: string) => service.addOption('evt_1', { name, location: 'Makati', capacity: 200, priceRange: 'PHP 300k-400k', availableDates: ['2027-02-14'] }, pmcm);
  return { service, add };
}

describe('FR-10 venue scouting', () => {
  it('shares the shortlist only once it has three options, and the client sees only shared ones', async () => {
    const f = fixture();
    await f.add('Hall A');
    await f.add('Hall B');
    await expect(f.service.publish('evt_1', pmcm)).rejects.toThrow(BadRequestException);
    expect((await f.service.get('evt_1', client)).options).toHaveLength(0);

    await f.add('Hall C');
    await f.service.publish('evt_1', pmcm);
    await f.add('Hall D');
    const seen = await f.service.get('evt_1', client);
    expect(seen.options.map((option) => option.name)).toEqual(['Hall A', 'Hall B', 'Hall C']);
  });

  it('keeps one preference per event and only the primary contact can choose it', async () => {
    const f = fixture();
    const [a, b] = [await f.add('Hall A'), await f.add('Hall B'), await f.add('Hall C')];
    await f.service.publish('evt_1', pmcm);

    await f.service.choosePreference('evt_1', { optionId: a.id, note: 'Closer to the church' }, client);
    const after = await f.service.choosePreference('evt_1', { optionId: b.id }, client);
    expect(after.preferredOptionId).toBe(b.id);
    expect(after.options.filter((option) => option.clientPreferredAt)).toHaveLength(1);

    await expect(f.service.choosePreference('evt_1', { optionId: a.id }, otherContact)).rejects.toThrow(ForbiddenException);
    await expect(f.service.choosePreference('evt_1', { optionId: a.id }, pmcm)).rejects.toThrow(ForbiddenException);
  });
});
