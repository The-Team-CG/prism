import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { createInquiryContextNoteSchema } from '@prism/types';
import { AccreditationService } from './accreditation.service';
import { InquiryContextNotesService } from '../onboarding/inquiry-context-notes.service';

const pmcm = { id: 'usr_pmcm', role: OpsUserRole.PmcmAdmin, name: 'Maxine', email: 'pmcm@test', explicit: true, verified: true };
const access = { requireActorRole: vi.fn(async () => undefined) };
const audit = { write: vi.fn(async () => undefined) };

describe('FR-70 accreditation tracker', () => {
  it('starts each document on its SLA, flags it overdue until accepted, and records when it was submitted', async () => {
    const rows: Array<Record<string, unknown> & { id: string }> = [];
    const prisma = {
      opsEvent: { findUnique: vi.fn(async () => ({ id: 'evt_1' })) },
      opsAccreditationRequirement: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> & { id: string } }) => { const row = { status: 'pending', submittedAt: null, ...data }; rows.push(row); return row; }),
        findFirst: vi.fn(async ({ where }: { where: { id: string } }) => rows.find((row) => row.id === where.id) ?? null),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(rows.find((row) => row.id === where.id)!, data)),
      },
    };
    const service = new AccreditationService(prisma as never, access as never, audit as never);
    const day0 = new Date('2026-11-01T00:00:00.000Z');
    const created = await service.create('evt_1', { documentName: 'SEC registration', dueInDays: 5 }, pmcm, day0);
    expect(created).toMatchObject({ dueAt: '2026-11-06T00:00:00.000Z', overdue: false, status: 'pending' });

    const late = new Date('2026-11-08T00:00:00.000Z');
    const submitted = await service.update('evt_1', created.id, { status: 'submitted' }, pmcm, late);
    expect(submitted).toMatchObject({ overdue: true, submittedAt: late.toISOString() });
    expect(await service.update('evt_1', created.id, { status: 'accepted' }, pmcm, late)).toMatchObject({ overdue: false, submittedAt: late.toISOString() });
  });
});

describe('FR-53 pre-conforme context notes', () => {
  it('requires a date on a follow-up and shows the inquiry notes on the event created from it', async () => {
    expect(createInquiryContextNoteSchema.safeParse({ kind: 'follow_up', body: 'Call back about the venue' }).success).toBe(false);
    const prisma = {
      opsEvent: { findUnique: vi.fn(async () => ({ inquiryId: 'inq_1' })) },
      opsInquiryContextNote: { findMany: vi.fn(async ({ where }: { where: { inquiryId: string } }) => where.inquiryId === 'inq_1'
        ? [{ id: 'n1', inquiryId: 'inq_1', kind: 'scope_flag', body: 'Client may add a second day', followUpAt: null, createdBy: 'Maxine', createdAt: new Date('2026-10-01T00:00:00.000Z') }]
        : []) },
    };
    const service = new InquiryContextNotesService(prisma as never, access as never, audit as never);
    expect(await service.forEvent('evt_1', pmcm)).toEqual([expect.objectContaining({ kind: 'scope_flag', body: 'Client may add a second day' })]);
  });
});
