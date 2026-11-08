import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { presentationMeetingIcs } from '@prism/types';
import { PresentationMeetingService, presentationAtRisk } from './presentation-meeting.service';

const pmcm = { id: 'usr_pmcm', role: OpsUserRole.PmcmAdmin, name: 'Maxine', email: 'pmcm@test', explicit: true, verified: true };
const client = { id: 'usr_client', role: OpsUserRole.Client, name: 'Ana', email: 'ana@test', explicit: true, verified: true };
const slots = [{ startsAt: '2027-01-10T02:00:00.000Z', endsAt: '2027-01-10T03:00:00.000Z' }, { startsAt: '2027-01-11T06:00:00.000Z', endsAt: '2027-01-11T07:00:00.000Z' }];

function fixture() {
  const rows: Array<Record<string, unknown> & { id: string; status: string }> = [];
  const table = {
    findMany: vi.fn(async () => rows.filter((row) => row.status !== 'superseded')),
    findFirst: vi.fn(async ({ where }: { where: { id: string } }) => rows.find((row) => row.id === where.id) ?? null),
    updateMany: vi.fn(async ({ data }: { data: { status: string } }) => { for (const row of rows) if (['proposed', 'scheduled'].includes(row.status)) row.status = data.status; return { count: 0 }; }),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> & { id: string } }) => { const row = { status: 'proposed', chosenStartAt: null, chosenEndAt: null, createdAt: new Date('2027-01-01T00:00:00.000Z'), ...data }; rows.push(row as never); return row; }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(rows.find((row) => row.id === where.id)!, data)),
  };
  const prisma = { opsPresentationMeeting: table, $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run(prisma)) };
  const access = {
    requireActorRole: vi.fn(async (actor: { role: string }, roles: string[]) => { if (!roles.includes(actor.role)) throw new ForbiddenException('no'); }),
    requireCanReadEvent: vi.fn(async () => undefined),
  };
  const events = { findEventReadAccess: vi.fn(async () => ({ id: 'evt_1', clientPortalStatus: 'unlocked', inquiry: { email: 'ana@test' } })) };
  return new PresentationMeetingService(prisma as never, access as never, { write: vi.fn(async () => undefined) } as never, events as never, { write: vi.fn(async () => undefined) } as never);
}

describe('FR-61 presentation meetings', () => {
  it('lets the client pick only an offered time, replaces the open proposal on reschedule, and gives a calendar file', async () => {
    const service = fixture();
    const first = await service.propose('evt_1', { title: 'Proposal walkthrough', slots, meetingLink: 'https://meet.example.test/abc' }, pmcm);
    await expect(service.choose('evt_1', first.id, { startsAt: '2027-01-12T02:00:00.000Z' }, client)).rejects.toThrow(BadRequestException);
    const second = await service.propose('evt_1', { title: 'Proposal walkthrough', slots }, pmcm);
    expect((await service.list('evt_1', pmcm)).meetings.map((meeting) => meeting.id)).toEqual([second.id]);
    const chosen = await service.choose('evt_1', second.id, { startsAt: slots[1]!.startsAt }, client);
    expect(chosen).toMatchObject({ status: 'scheduled', chosen: slots[1] });
    expect(presentationMeetingIcs(chosen)).toContain('DTSTART:20270111T060000Z');
    await expect(service.recordOutcome('evt_1', second.id, { outcome: 'no_show' }, client)).rejects.toThrow(ForbiddenException);
  });

  it('flags the client at risk after two no-shows in a row only', () => {
    expect(presentationAtRisk([{ status: 'no_show' }, { status: 'no_show' }, { status: 'attended' }])).toBe(true);
    expect(presentationAtRisk([{ status: 'no_show' }, { status: 'attended' }, { status: 'no_show' }])).toBe(false);
    expect(presentationAtRisk([{ status: 'scheduled' }, { status: 'no_show' }])).toBe(false);
  });
});
