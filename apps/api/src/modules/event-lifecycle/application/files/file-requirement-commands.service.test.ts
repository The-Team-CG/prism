import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { mergeFileRequirementOverrides, type DerivedFileRequirementItem } from '../../domain/file-requirement-matrix.policy';
import { FileRequirementCommandsService } from './file-requirement-commands.service';

const eventId = 'evt_file';
const createInput = {
  key: 'venue_permit', label: 'Venue permit', ownerRole: 'client', visibleToRoles: ['pmcm-admin', 'client'], required: true, dueAt: '2026-10-25T23:59:59.000Z', sourceWorkflow: 'custom', notes: 'Internal chase note',
} as never;
const pmcm = { id: 'user_pmcm', role: 'pmcm-admin', name: 'PMCM Admin', email: 'pmcm@example.test', explicit: true, verified: true } as never;

const signedConforme: DerivedFileRequirementItem = {
  key: 'signed_conforme', label: 'Signed conforme', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin', 'client'],
  sourceWorkflow: 'client_onboarding', status: 'missing', auditCategory: 'documents', detail: '',
};

type Row = Record<string, any>;

/** Uses the real merge policy so overrides, custom rows, and rejected uploads flow through the same rules as production. */
function createHarness(options: { rows?: Row[]; derived?: DerivedFileRequirementItem[]; rejectedDocuments?: Array<{ id: string; type: string }>; dueEvents?: string[] } = {}) {
  const rows: Row[] = [...(options.rows ?? [])];
  const audits: Array<Record<string, any>> = [];
  const outbox: Array<Record<string, any>> = [];
  const tx = {
    opsEvent: { findUnique: vi.fn(async () => ({ id: eventId, archived: false })), findMany: vi.fn(async () => (options.dueEvents ?? []).map((id) => ({ id }))) },
    opsFileRequirement: {
      findUnique: vi.fn(async ({ where }: { where: { eventId_key: { eventId: string; key: string } } }) => rows.find((row) => row.key === where.eventId_key.key) ?? null),
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = { revision: 1, dueAt: null, notes: null, ...data, id: `freq_${rows.length + 1}` };
        rows.push(row);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; revision: number }; data: Row }) => {
        const row = rows.find((candidate) => candidate.id === where.id && candidate.revision === where.revision);
        if (!row) return { count: 0 };
        Object.assign(row, data, { revision: row.revision + 1 });
        return { count: 1 };
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => rows.find((row) => row.id === where.id)),
    },
    opsDocument: { findMany: vi.fn(async () => options.rejectedDocuments ?? []) },
  };
  const prisma = { ...tx, $transaction: vi.fn(async (work: (client: unknown) => Promise<unknown>) => work(tx)) };
  const matrix = {
    buildForEvent: vi.fn(async (_eventId: string, _client?: unknown, now = new Date()) => ({
      eventId,
      items: mergeFileRequirementOverrides(
        options.derived ?? [signedConforme],
        rows.map((row) => ({ ...row, dueAt: row.dueAt ?? null }) as never),
        (options.rejectedDocuments ?? []).map((document) => ({ id: document.id, type: document.type, status: 'submitted', validationStatus: 'rejected', uploadedAt: new Date('2026-10-10T00:00:00.000Z') })),
        now,
      ),
    })),
  };
  const accessPolicy = {
    requireActorRole: vi.fn(async (candidate: { role: string }, roles: readonly string[], resource: string) => {
      if (!roles.includes(candidate.role)) throw new ForbiddenException(`${candidate.role} cannot access ${resource}`);
    }),
  };
  const auditWriter = { write: vi.fn(async (input: Record<string, any>) => { audits.push(input); return input; }) };
  const notificationOutboxWriter = { write: vi.fn(async (input: Record<string, any>) => { outbox.push(input); return input; }) };
  const service = new FileRequirementCommandsService(prisma as never, matrix as never, accessPolicy as never, auditWriter as never, notificationOutboxWriter as never);
  return { service, rows, audits, outbox, tx };
}

describe('FileRequirementCommandsService', () => {
  it.each([
    ['client', { id: 'user_client', role: 'client', name: 'Client', explicit: true }],
    ['supplier', { id: 'user_supplier', role: 'supplier', name: 'Supplier', explicit: true }],
    ['coordinator', { id: 'user_coord', role: 'coordinator', name: 'Coordinator', explicit: true }],
    ['guest', { id: 'user_guest', role: 'guest', name: 'Guest', explicit: true }],
  ])('refuses %s create and update before any write or audit', async (_label, actor) => {
    const harness = createHarness({ rows: [{ id: 'freq_1', eventId, key: 'venue_permit', label: 'Venue permit', ownerRole: 'client', visibleToRoles: ['pmcm-admin', 'client'], required: true, dueAt: null, sourceWorkflow: 'custom', isCustom: true, notes: null, revision: 1, updatedBy: 'x' }] });
    await expect(harness.service.createRequirement(eventId, createInput, actor as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(harness.service.updateRequirement(eventId, 'venue_permit', { required: false }, actor as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(harness.tx.opsFileRequirement.create).not.toHaveBeenCalled();
    expect(harness.tx.opsFileRequirement.updateMany).not.toHaveBeenCalled();
    expect(harness.audits).toHaveLength(0);
  });

  it('creates a custom requirement and audits metadata without the PMCM-private notes', async () => {
    const harness = createHarness();
    const created = await harness.service.createRequirement(eventId, createInput, pmcm);
    expect(created).toMatchObject({ key: 'venue_permit', origin: 'custom', ownerRole: 'client' });
    expect(harness.audits).toHaveLength(1);
    expect(harness.audits[0]).toMatchObject({ action: 'Created file requirement', eventId, metadata: expect.objectContaining({ key: 'venue_permit', isCustom: true }) });
    expect(JSON.stringify(harness.audits)).not.toContain('Internal chase note');
  });

  it('rejects creating a workflow-derived key and a duplicate custom key', async () => {
    const harness = createHarness({ rows: [{ id: 'freq_1', eventId, key: 'venue_permit', isCustom: true, label: 'Venue permit', ownerRole: 'client', visibleToRoles: ['pmcm-admin', 'client'], required: true, dueAt: null, sourceWorkflow: 'custom', notes: null, revision: 1 }] });
    await expect(harness.service.createRequirement(eventId, { ...(createInput as object), key: 'signed_conforme' } as never, pmcm)).rejects.toBeInstanceOf(ConflictException);
    await expect(harness.service.createRequirement(eventId, createInput, pmcm)).rejects.toBeInstanceOf(ConflictException);
  });

  it('applies a derived override, rejects stale revisions, and audits a visibility change separately', async () => {
    const harness = createHarness();
    const updated = await harness.service.updateRequirement(eventId, 'signed_conforme', { visibleToRoles: ['pmcm-admin'], expectedRevision: 0 } as never, pmcm);
    expect(updated).toMatchObject({ key: 'signed_conforme', visibleToRoles: ['pmcm-admin'], origin: 'derived', revision: 1 });
    expect(harness.audits.map((audit) => audit.action)).toEqual(['Updated file requirement', 'Changed file requirement visibility']);

    await expect(harness.service.updateRequirement(eventId, 'signed_conforme', { required: false, expectedRevision: 0 } as never, pmcm)).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses to relabel a workflow-derived requirement or strip PMCM from visibility', async () => {
    const harness = createHarness();
    await expect(harness.service.updateRequirement(eventId, 'signed_conforme', { label: 'Renamed' } as never, pmcm)).rejects.toBeInstanceOf(BadRequestException);
    await expect(harness.service.updateRequirement(eventId, 'signed_conforme', { visibleToRoles: ['client'] } as never, pmcm)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('queues overdue reminders to the owner and PMCM with stable idempotency keys across repeated sweeps', async () => {
    const overdueRow = { id: 'freq_1', eventId, key: 'signed_conforme', label: 'Signed conforme', ownerRole: 'client', visibleToRoles: ['pmcm-admin', 'client'], required: true, dueAt: new Date('2026-10-01T00:00:00.000Z'), sourceWorkflow: 'client_onboarding', isCustom: false, notes: null, revision: 2 };
    const harness = createHarness({ rows: [overdueRow], dueEvents: [eventId] });
    const now = new Date('2026-10-20T00:00:00.000Z');

    const first = await harness.service.runReminderSweep(now);
    const second = await harness.service.runReminderSweep(now);

    expect(first.reminders.map((reminder) => [reminder.reason, reminder.recipient])).toEqual([['overdue', 'Client'], ['overdue', 'PMCM Admin']]);
    expect(second.reminders.map((reminder) => reminder.idempotencyKey)).toEqual(first.reminders.map((reminder) => reminder.idempotencyKey));
    expect(new Set(first.reminders.map((reminder) => reminder.idempotencyKey)).size).toBe(2);
    expect(harness.outbox.every((entry) => entry.idempotencyKey && entry.eventId === eventId)).toBe(true);
  });

  it('queues a rejected-upload reminder for required items, anchored to the rejected document', async () => {
    const harness = createHarness({
      derived: [{ ...signedConforme, ownerRole: 'client', visibleToRoles: ['pmcm-admin', 'client'] }],
      rejectedDocuments: [{ id: 'doc_rejected', type: 'signed_conforme' }],
      dueEvents: [eventId],
    });
    const result = await harness.service.runReminderSweep(new Date('2026-10-20T00:00:00.000Z'));
    expect(result.reminders.map((reminder) => reminder.reason)).toEqual(['rejected', 'rejected']);
    expect(result.reminders[0].idempotencyKey).toContain('doc_rejected');
  });
});
