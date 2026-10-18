import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { archiveComparisonQuerySchema, recordLogisticsCompletionSchema } from '@prism/types';
import { EventClosureService } from './event-closure.service';

const PRIVATE_NOTE = 'PRIVATE: forklift damage deducted from supplier invoice';
const SUMMARY = 'All AV and staging returned to the warehouse';

function harness(options: { archived?: boolean; existingRecord?: Record<string, unknown> | null; events?: Array<Record<string, unknown>> } = {}) {
  const logistics = {
    record: options.existingRecord ?? null,
    findUnique: vi.fn(async () => logistics.record),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      logistics.record = { ...data, revision: 1, correctionReason: data.correctionReason ?? null, createdAt: new Date(), updatedAt: new Date() };
      return logistics.record;
    }),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> & { revision?: { increment: number } } }) => {
      const { revision, ...rest } = data;
      logistics.record = { ...logistics.record, ...rest, revision: (logistics.record as { revision: number }).revision + (revision?.increment ?? 0) };
      return logistics.record;
    }),
  };
  const event = { id: 'event_1', inquiryId: 'inquiry_1', clientName: 'Client', archived: options.archived ?? false, status: 'archived' };
  const opsEvent = {
    findUnique: vi.fn(async () => event),
    findMany: vi.fn(async () => options.events ?? []),
  };
  const prisma = {
    opsEvent,
    opsLogisticsCompletion: logistics,
    $transaction: vi.fn(async <T>(work: (tx: unknown) => Promise<T>) => work(prisma)),
  };
  const audit = { write: vi.fn(async (..._args: unknown[]) => undefined) };
  const access = {
    resolveActor: () => ({ role: OpsUserRole.PmcmAdmin, name: 'Francis', email: 'pmcm@example.test', id: 'pmcm_1' }),
    requireActorRole: vi.fn(async (actor: { role: string }, roles: string[], resource: string) => {
      if (!roles.includes(actor.role)) throw new ForbiddenException(`${actor.role} cannot access ${resource}`);
    }),
  };
  const service = new EventClosureService(
    prisma as never, {} as never, {} as never, audit as never, access as never, {} as never, {} as never, {} as never, {} as never,
  );
  return { service, logistics, audit, opsEvent };
}

const pmcm = { role: OpsUserRole.PmcmAdmin, name: 'Francis', email: 'pmcm@example.test', id: 'pmcm_1' } as never;
const client = { role: OpsUserRole.Client, name: 'Ana', email: 'ana@ayala.test', id: 'client_1' } as never;
const supplier = { role: OpsUserRole.Supplier, name: 'Vendor', email: 'vendor@example.test', id: 'supplier_1' } as never;

const completion = { assetReturnsVerified: true, completionSummary: SUMMARY, privateNotes: PRIVATE_NOTE };

describe('logistics completion record', () => {
  it('lets only PMCM and system record or read logistics completion', async () => {
    for (const actor of [client, supplier]) {
      const { service, logistics } = harness();
      await expect(service.recordLogisticsCompletion('event_1', recordLogisticsCompletionSchema.parse(completion), actor)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.getLogisticsCompletion('event_1', actor)).rejects.toBeInstanceOf(ForbiddenException);
      expect(logistics.create).not.toHaveBeenCalled();
    }
  });

  it('records a completion, audits it without the notes, and keeps notes in the PMCM response only', async () => {
    const { service, audit } = harness();
    const saved = await service.recordLogisticsCompletion('event_1', recordLogisticsCompletionSchema.parse(completion), pmcm);
    expect(saved).toMatchObject({ assetReturnsVerified: true, revision: 1, recordedBy: 'pmcm_1', privateNotes: PRIVATE_NOTE });
    // Only the audit payload is checked; the second argument is the transaction context, which holds the stored record.
    const auditPayload = JSON.stringify(audit.write.mock.calls.map(([payload]) => payload));
    expect(auditPayload).toContain('Recorded logistics completion');
    expect(auditPayload).not.toContain(PRIVATE_NOTE);
    expect(auditPayload).not.toContain(SUMMARY);
  });

  it('requires a correction reason to replace an existing record and increments its revision', async () => {
    const existing = { id: 'logi_1', eventId: 'event_1', assetReturnsVerified: true, completionSummary: SUMMARY, privateNotes: '', correctionReason: null, revision: 1, recordedBy: 'pmcm_1', recordedAt: new Date('2026-10-18T10:00:00Z') };
    const { service } = harness({ existingRecord: existing });
    await expect(service.recordLogisticsCompletion('event_1', recordLogisticsCompletionSchema.parse(completion), pmcm)).rejects.toBeInstanceOf(BadRequestException);
    const corrected = await service.recordLogisticsCompletion('event_1', recordLogisticsCompletionSchema.parse({ ...completion, correctionReason: 'Late crate return' }), pmcm);
    expect(corrected).toMatchObject({ revision: 2, correctionReason: 'Late crate return' });
  });

  it('refuses to change logistics on an archived event', async () => {
    const { service, logistics } = harness({ archived: true });
    await expect(service.recordLogisticsCompletion('event_1', recordLogisticsCompletionSchema.parse(completion), pmcm)).rejects.toBeInstanceOf(BadRequestException);
    expect(logistics.create).not.toHaveBeenCalled();
  });

  it('rejects a completion that does not confirm asset returns', () => {
    expect(recordLogisticsCompletionSchema.safeParse({ ...completion, assetReturnsVerified: false }).success).toBe(false);
  });
});

describe('archive comparison', () => {
  const archivedRow = (id: string, overrides: Record<string, unknown> = {}) => ({
    id, eventName: `Event ${id}`, clientName: 'Client', eventDate: new Date('2026-09-01T00:00:00Z'), archivedAt: new Date('2026-09-10T00:00:00Z'),
    actualEndedAt: null, archiveOverrideReason: null, archiveChecklist: { ready: true, missingKeys: [] },
    inquiry: { eventType: 'Gala' }, briefings: [{ venue: 'Shangri-La' }], logisticsCompletion: { assetReturnsVerified: true, recordedAt: new Date('2026-09-05T00:00:00Z'), privateNotes: PRIVATE_NOTE, completionSummary: SUMMARY },
    ...overrides,
  });

  it('rejects client and supplier actors from comparing archived events', async () => {
    for (const actor of [client, supplier]) {
      const { service, opsEvent } = harness({ events: [archivedRow('a'), archivedRow('b')] });
      await expect(service.compareArchivedEvents(archiveComparisonQuerySchema.parse({ eventIds: 'a,b' }), actor)).rejects.toBeInstanceOf(ForbiddenException);
      expect(opsEvent.findMany).not.toHaveBeenCalled();
    }
  });

  it('returns columns in the requested order and omits private notes and logistics summaries', async () => {
    const { service } = harness({ events: [archivedRow('b', { archiveOverrideReason: 'Venue closed early' }), archivedRow('a', { archiveChecklist: { ready: false, missingKeys: ['billing'] }, logisticsCompletion: null })] });
    const rows = await service.compareArchivedEvents(archiveComparisonQuerySchema.parse({ eventIds: 'a,b' }), pmcm);
    expect(rows.map((row) => row.id)).toEqual(['a', 'b']);
    expect(rows[0]).toMatchObject({ venue: 'Shangri-La', eventType: 'Gala', closeGatesReady: false, missingCloseGates: ['billing'], logisticsRecorded: false });
    expect(rows[1]).toMatchObject({ archiveOverridden: true, archiveOverrideReason: 'Venue closed early', logisticsRecorded: true });
    expect(JSON.stringify(rows)).not.toContain(PRIVATE_NOTE);
    expect(JSON.stringify(rows)).not.toContain(SUMMARY);
  });

  it('fails the whole comparison when a requested event is not an archived event', async () => {
    const { service } = harness({ events: [archivedRow('a')] });
    await expect(service.compareArchivedEvents(archiveComparisonQuerySchema.parse({ eventIds: 'a,missing' }), pmcm)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('archiveComparisonQuerySchema', () => {
  it('accepts two to four distinct ids and rejects other selections', () => {
    expect(archiveComparisonQuerySchema.safeParse({ eventIds: 'a,b' }).success).toBe(true);
    expect(archiveComparisonQuerySchema.safeParse({ eventIds: 'a,b,c,d' }).success).toBe(true);
    expect(archiveComparisonQuerySchema.safeParse({ eventIds: 'a' }).success).toBe(false);
    expect(archiveComparisonQuerySchema.safeParse({ eventIds: 'a,b,c,d,e' }).success).toBe(false);
    expect(archiveComparisonQuerySchema.safeParse({ eventIds: 'a,a' }).success).toBe(false);
  });
});
