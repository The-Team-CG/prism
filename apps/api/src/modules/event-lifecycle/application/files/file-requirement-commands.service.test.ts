import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
type HarnessSupplier = { supplierId: string; supplierName: string; email: string };

const atlas: HarnessSupplier = { supplierId: 'supplier_atlas', supplierName: 'Atlas Sound', email: 'atlas@example.test' };
const sonic: HarnessSupplier = { supplierId: 'supplier_sonic', supplierName: 'Sonic Line Events', email: 'sonic@example.test' };
/** A supplier-owned custom requirement; a fresh row each call because the harness mutates persisted rows. */
const insuranceRequirement = (dueAt = '2026-10-01T00:00:00.000Z') => ({
  id: 'freq_sup', eventId, key: 'insurance_certificate', label: 'Insurance certificate', ownerRole: 'supplier', visibleToRoles: ['pmcm-admin', 'supplier'],
  required: true, dueAt: new Date(dueAt), sourceWorkflow: 'custom', isCustom: true, notes: null, revision: 1, updatedBy: 'pmcm',
});

function createHarness(options: {
  rows?: Row[];
  derived?: DerivedFileRequirementItem[];
  rejectedDocuments?: Array<{ id: string; type: string }>;
  /** Documents stored by one selected supplier; the matrix attributes them to that supplier only. */
  supplierDocuments?: Array<{ id: string; type: string; ownerSupplierId: string; validationStatus?: 'accepted' | 'rejected' }>;
  dueEvents?: string[];
  storedUpload?: Row | null;
  suppliers?: HarnessSupplier[];
  openSuppliers?: HarnessSupplier[];
} = {}) {
  const selectedSuppliers = options.suppliers ?? [];
  // Open quote requests exist on the event but are not selected: they resolve the actor's event scope, never a booking.
  const quoteRequests = [...selectedSuppliers, ...(options.openSuppliers ?? [])];
  // Only the stored upload's owner is known to the matrix stand-in, mirroring the real object-owner mapping.
  const supplierOwnerOf = (storageKey: unknown) => (options.storedUpload?.id === storageKey && options.storedUpload?.ownerRecordType === 'supplier' ? options.storedUpload.ownerRecordId as string : null);
  const rows: Row[] = [...(options.rows ?? [])];
  const documents: Row[] = [];
  const templates: Row[] = [];
  const audits: Array<Record<string, any>> = [];
  const outbox: Array<Record<string, any>> = [];
  // Only the suppliers selected on the event have contact emails read for reminders.
  const accountContacts = { findSelectedSupplierContacts: vi.fn(async () => selectedSuppliers.map((supplier) => ({ supplierId: supplier.supplierId, email: supplier.email || null }))) };
  const tx = {
    opsEvent: {
      findUnique: vi.fn(async () => ({ id: eventId, archived: false, eventDate: new Date('2026-12-01T00:00:00.000Z'), inquiry: { eventType: 'wedding' } })),
      findMany: vi.fn(async (_query?: { where?: { id?: { gt?: string } }; take?: number }) => (options.dueEvents ?? []).map((id) => ({ id }))),
    },
    opsFileRequirement: {
      findUnique: vi.fn(async ({ where }: { where: { eventId_key: { eventId: string; key: string } } }) => rows.find((row) => row.key === where.eventId_key.key) ?? null),
      findMany: vi.fn(async ({ where }: { where: Row }) => rows.filter((row) => row.eventId === where.eventId)),
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
    opsFileRequirementTemplate: {
      findMany: vi.fn(async () => templates),
      findUnique: vi.fn(async ({ where }: { where: { eventType: string } }) => templates.find((row) => row.eventType === where.eventType) ?? null),
      upsert: vi.fn(async ({ where, create, update }: { where: { eventType: string }; create: Row; update: Row }) => {
        const existing = templates.find((row) => row.eventType === where.eventType);
        if (existing) { Object.assign(existing, update, { revision: existing.revision + 1 }); return existing; }
        const row = { revision: 1, ...create, id: `frt_${templates.length + 1}`, updatedAt: new Date() };
        templates.push(row); return row;
      }),
    },
    opsSupplierQuoteRequest: {
      findMany: vi.fn(async (query?: { where?: { status?: string; supplierId?: { in: string[] } } }) => (query?.where?.status === 'selected' ? selectedSuppliers : quoteRequests).filter((supplier) => !query?.where?.supplierId?.in || query.where.supplierId.in.includes(supplier.supplierId)).map((supplier) => ({ supplierId: supplier.supplierId, supplierName: supplier.supplierName, supplier: { email: supplier.email } }))),
      findFirst: vi.fn(async ({ where }: { where: Row }) => (where.supplierId && selectedSuppliers.some((supplier) => supplier.supplierId === where.supplierId) ? { id: `sqr_${where.supplierId}` } : null)),
    },
    opsCoordinatorAssignment: { findMany: vi.fn(async () => []) },
    opsDocument: {
      findMany: vi.fn(async () => options.rejectedDocuments ?? []),
      findFirst: vi.fn(async ({ where }: { where: Row }) => documents.find((row) => row.eventId === where.eventId && row.storageKey === where.storageKey) ?? null),
      create: vi.fn(async ({ data }: { data: Row }) => { documents.push(data); return data; }),
      updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const row = documents.find((document) => Object.entries(where).every(([key, value]) => document[key] === value));
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
  };
  const prisma = { ...tx, $transaction: vi.fn(async (work: (client: unknown) => Promise<unknown>) => work(tx)) };
  const matrix = {
    buildForEvent: vi.fn(async (_eventId: string, _client?: unknown, now = new Date()) => ({
      eventId,
      items: mergeFileRequirementOverrides(
        options.derived ?? [signedConforme],
        rows.map((row) => ({ ...row, dueAt: row.dueAt ?? null }) as never),
        [
          ...(options.rejectedDocuments ?? []).map((document) => ({ id: document.id, type: document.type, status: 'submitted', validationStatus: 'rejected', uploadedAt: new Date('2026-10-10T00:00:00.000Z') })),
          ...(options.supplierDocuments ?? []).map((document) => ({ id: document.id, type: document.type, status: 'submitted', validationStatus: document.validationStatus ?? 'accepted', uploadedAt: new Date('2026-10-10T00:00:00.000Z'), ownerSupplierId: document.ownerSupplierId })),
          ...documents.map((document) => ({ id: document.id, type: document.type, status: document.status, validationStatus: document.validationStatus, rejectionReason: document.rejectionReason, uploadedAt: document.uploadedAt, storageKey: document.storageKey, ownerSupplierId: supplierOwnerOf(document.storageKey) })),
        ],
        selectedSuppliers.map(({ supplierId, supplierName }) => ({ supplierId, supplierName })),
        now,
      ),
    })),
  };
  const accessPolicy = {
    requireActorRole: vi.fn(async (candidate: { role: string }, roles: readonly string[], resource: string) => {
      if (!roles.includes(candidate.role)) throw new ForbiddenException(`${candidate.role} cannot access ${resource}`);
    }),
    requireCanReadEvent: vi.fn(async () => undefined),
    recordForbiddenAccess: vi.fn(async () => undefined),
  };
  const auditWriter = { write: vi.fn(async (input: Record<string, any>) => { audits.push(input); return input; }) };
  // Mirrors the outbox's idempotency: a repeated key keeps the existing row rather than queueing another.
  const notificationOutboxWriter = { write: vi.fn(async (input: Record<string, any>) => {
    if (!outbox.some((entry) => entry.idempotencyKey === input.idempotencyKey)) outbox.push(input);
    return input;
  }) };
  const storedRequirementUploads = { findStoredRequirementUpload: vi.fn(async () => options.storedUpload ?? null) };
  const service = new FileRequirementCommandsService(prisma as never, matrix as never, accessPolicy as never, auditWriter as never, notificationOutboxWriter as never, storedRequirementUploads as never, accountContacts as never);
  return { service, rows, audits, outbox, tx, prisma, matrix, documents, templates, storedRequirementUploads, accessPolicy };
}

describe('FileRequirementCommandsService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T00:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('recovers from an aborted requirement write without duplicating the requirement or audit', async () => {
    const harness = createHarness();
    harness.prisma.$transaction.mockRejectedValueOnce(Object.assign(new Error('Serialization failure'), { code: 'P2034' }));
    await expect(harness.service.createRequirement(eventId, createInput, pmcm)).resolves.toMatchObject({ key: 'venue_permit' });
    expect(harness.rows).toHaveLength(1);
    expect(harness.audits).toHaveLength(1);
    harness.prisma.$transaction.mockRejectedValueOnce(Object.assign(new Error('Serialization failure'), { code: 'P2034' }));
    await expect(harness.service.updateRequirement(eventId, 'venue_permit', { required: false, expectedRevision: 1 }, pmcm)).resolves.toMatchObject({ required: false });
    expect(harness.rows).toHaveLength(1);
    expect(harness.audits).toHaveLength(2);
  });

  it('returns a recoverable conflict after repeated transaction aborts and preserves unrelated errors', async () => {
    const harness = createHarness();
    harness.prisma.$transaction.mockRejectedValue(Object.assign(new Error('Serialization failure'), { code: 'P2034' }));
    await expect(harness.service.createRequirement(eventId, createInput, pmcm)).rejects.toBeInstanceOf(ConflictException);
    expect(harness.prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(harness.rows).toHaveLength(0);
    harness.prisma.$transaction.mockRejectedValueOnce(new Error('Database offline'));
    await expect(harness.service.createRequirement(eventId, createInput, pmcm)).rejects.toThrow('Database offline');
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

  it('paginates the reminder sweep through every eligible event beyond the first 100', async () => {
    const overdueRow = { id: 'freq_1', eventId, key: 'signed_conforme', label: 'Signed conforme', ownerRole: 'client', visibleToRoles: ['pmcm-admin', 'client'], required: true, dueAt: new Date('2026-10-01T00:00:00.000Z'), sourceWorkflow: 'client_onboarding', isCustom: false, notes: null, revision: 2 };
    const eventIds = Array.from({ length: 205 }, (_, index) => `evt_${String(index + 1).padStart(3, '0')}`);
    const harness = createHarness({ rows: [overdueRow] });
    harness.prisma.opsEvent.findMany.mockImplementation(async (query) => {
      const afterId = query?.where?.id?.gt;
      return eventIds.filter((id) => !afterId || id > afterId).slice(0, query?.take ?? 100).map((id) => ({ id }));
    });

    const result = await harness.service.runReminderSweep(new Date('2026-10-20T00:00:00.000Z'));

    expect(harness.prisma.opsEvent.findMany).toHaveBeenCalledTimes(3);
    expect(harness.prisma.opsEvent.findMany.mock.calls.map(([query]) => query?.where?.id?.gt ?? null)).toEqual([null, 'evt_100', 'evt_200']);
    expect(new Set(result.reminders.map((reminder) => reminder.eventId))).toEqual(new Set(eventIds));
    expect(harness.outbox).toHaveLength(eventIds.length * 2);
    expect(new Set(harness.outbox.map((entry) => entry.idempotencyKey)).size).toBe(harness.outbox.length);
  });

  it('still sends reminders for later events when one event fails to build its matrix', async () => {
    const overdueRow = { id: 'freq_1', eventId, key: 'signed_conforme', label: 'Signed conforme', ownerRole: 'client', visibleToRoles: ['pmcm-admin', 'client'], required: true, dueAt: new Date('2026-10-01T00:00:00.000Z'), sourceWorkflow: 'client_onboarding', isCustom: false, notes: null, revision: 2 };
    const harness = createHarness({ rows: [overdueRow], dueEvents: ['evt_001', 'evt_002', 'evt_003'] });
    const buildForEvent = harness.matrix.buildForEvent.getMockImplementation()!;
    harness.matrix.buildForEvent.mockImplementation(async (candidateId: string, client?: unknown, now?: Date) => {
      if (candidateId === 'evt_002') throw new Error('Matrix unavailable');
      return buildForEvent(candidateId, client, now);
    });

    const result = await harness.service.runReminderSweep(new Date('2026-10-20T00:00:00.000Z'));

    expect(new Set(result.reminders.map((reminder) => reminder.eventId))).toEqual(new Set(['evt_001', 'evt_003']));
    expect(result.reminders).toHaveLength(4);
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

  it('reminds only the overdue supplier at its own contact, plus one PMCM reminder, and never names another supplier', async () => {
    const harness = createHarness({ rows: [insuranceRequirement()], suppliers: [atlas, sonic], dueEvents: [eventId], supplierDocuments: [{ id: 'doc_atlas', type: 'insurance_certificate', ownerSupplierId: atlas.supplierId }] });

    const result = await harness.service.runReminderSweep(new Date('2026-10-20T00:00:00.000Z'));

    expect(result.reminders.map(({ recipient }) => recipient).sort()).toEqual(['PMCM Admin', 'sonic@example.test']);
    expect(harness.outbox.map(({ recipient }) => recipient).sort()).toEqual(['PMCM Admin', 'sonic@example.test']);
    expect(JSON.stringify(harness.outbox)).not.toContain('Atlas Sound');
  });

  it('keeps a repeated sweep from queueing supplier reminders again', async () => {
    const harness = createHarness({ rows: [insuranceRequirement()], suppliers: [atlas, sonic], dueEvents: [eventId] });
    const now = new Date('2026-10-20T00:00:00.000Z');

    await harness.service.runReminderSweep(now);
    expect(harness.outbox).toHaveLength(3);
    await harness.service.runReminderSweep(now);
    expect(harness.outbox).toHaveLength(3);
  });

  it('sends a rejected reminder only to the supplier whose upload was rejected', async () => {
    const harness = createHarness({
      rows: [insuranceRequirement('2026-11-30T00:00:00.000Z')],
      suppliers: [atlas, sonic],
      dueEvents: [eventId],
      supplierDocuments: [
        { id: 'doc_atlas', type: 'insurance_certificate', ownerSupplierId: atlas.supplierId },
        { id: 'doc_sonic', type: 'insurance_certificate', ownerSupplierId: sonic.supplierId, validationStatus: 'rejected' },
      ],
    });

    const result = await harness.service.runReminderSweep(new Date('2026-10-20T00:00:00.000Z'));

    expect(result.reminders.map(({ recipient, reason }) => `${recipient}:${reason}`).sort()).toEqual(['PMCM Admin:rejected', 'sonic@example.test:rejected']);
    expect(result.reminders.find(({ recipient }) => recipient === 'sonic@example.test')?.idempotencyKey)
      .toBe('file-requirement-rejected:evt_file:insurance_certificate:r1:doc_sonic:supplier:supplier_sonic');
  });

  it('skips a supplier with no contact email and still reminds the others', async () => {
    const harness = createHarness({ rows: [insuranceRequirement()], suppliers: [{ ...atlas, email: '' }, sonic], dueEvents: [eventId] });

    const result = await harness.service.runReminderSweep(new Date('2026-10-20T00:00:00.000Z'));

    expect(result.reminders.map(({ recipient }) => recipient).sort()).toEqual(['PMCM Admin', 'sonic@example.test']);
  });

  it('lets PMCM queue event-scoped overdue reminders and rejects client-triggered reminders', async () => {
    const overdueRow = { id: 'freq_1', eventId, key: 'signed_conforme', label: 'Signed conforme', ownerRole: 'client', visibleToRoles: ['pmcm-admin', 'client'], required: true, dueAt: new Date('2026-10-01T00:00:00.000Z'), sourceWorkflow: 'client_onboarding', isCustom: false, notes: null, revision: 2 };
    const harness = createHarness({ rows: [overdueRow] });
    const result = await harness.service.sendReminders(eventId, pmcm, new Date('2026-10-20T00:00:00.000Z'));
    expect(result.reminders.map(({ reason, recipient }) => [reason, recipient])).toEqual([['overdue', 'Client'], ['overdue', 'PMCM Admin']]);
    expect(harness.outbox).toHaveLength(2);
    await expect(harness.service.sendReminders(eventId, { role: 'client' } as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(harness.outbox).toHaveLength(2);
  });

  it('binds only the requirement owner uploaded bytes from the same event and is idempotent', async () => {
    const requirement = { id: 'freq_1', eventId, key: 'venue_permit', label: 'Venue permit', ownerRole: 'client', visibleToRoles: ['pmcm-admin', 'client'], required: true, dueAt: null, sourceWorkflow: 'custom', isCustom: true, notes: 'private', revision: 1, updatedBy: 'pmcm' };
    const upload = { id: 'obj_1', eventId, ownerRecordType: 'event', ownerRecordId: eventId, usage: 'client_document', lifecycleState: 'stored', originalFileName: 'permit.pdf', contentType: 'application/pdf', declaredByteSize: 100, uploaderActorId: 'client_1', uploaderActorRole: 'client' };
    const client = { id: 'client_1', role: 'client', name: 'Client', explicit: true, verified: true };
    const harness = createHarness({ rows: [requirement], storedUpload: upload });
    await expect(harness.service.bindRequirementUpload(eventId, requirement.key, { objectId: upload.id }, client as never)).resolves.toMatchObject({ key: requirement.key, status: 'submitted' });
    await harness.service.bindRequirementUpload(eventId, requirement.key, { objectId: upload.id }, client as never);
    expect(harness.documents).toHaveLength(1);
    expect(harness.documents[0]).toMatchObject({ type: requirement.key, storageKey: upload.id, fileName: 'permit.pdf' });
    expect(harness.audits).toHaveLength(1);
    expect(harness.storedRequirementUploads.findStoredRequirementUpload).toHaveBeenCalledWith(expect.objectContaining({ eventId, objectId: upload.id, context: expect.objectContaining({ correlationId: expect.any(String) }) }));

    harness.storedRequirementUploads.findStoredRequirementUpload.mockResolvedValueOnce({ ...upload, eventId: 'evt_other' });
    await expect(harness.service.bindRequirementUpload(eventId, requirement.key, { objectId: upload.id }, client as never)).rejects.toThrow('stored for this event');
    expect(harness.documents).toHaveLength(1);

    const changedOwner = createHarness({ rows: [{ ...requirement, ownerRole: 'supplier', visibleToRoles: ['pmcm-admin', 'supplier'] }], storedUpload: upload });
    await expect(changedOwner.service.bindRequirementUpload(eventId, requirement.key, { objectId: upload.id }, client as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(changedOwner.storedRequirementUploads.findStoredRequirementUpload).not.toHaveBeenCalled();
    expect(changedOwner.documents).toHaveLength(0);
  });

  it("returns a supplier only its own fulfilment after it binds its own upload, never another supplier's object", async () => {
    const requirement = { id: 'freq_2', eventId, key: 'insurance_certificate', label: 'Insurance certificate', ownerRole: 'supplier', visibleToRoles: ['pmcm-admin', 'supplier'], required: true, dueAt: null, sourceWorkflow: 'custom', isCustom: true, notes: 'private', revision: 1, updatedBy: 'pmcm' };
    const upload = { id: 'obj_sonic', eventId, logicalTarget: 'supplier-requirement:insurance_certificate:123e4567-e89b-42d3-a456-426614174000', ownerRecordType: 'supplier', ownerRecordId: 'supplier_sonic', usage: 'supplier_document', lifecycleState: 'stored', originalFileName: 'insurance.pdf', contentType: 'application/pdf', declaredByteSize: 100, uploaderActorId: 'usr_sonic', uploaderActorRole: 'supplier' };
    const suppliers = [
      { supplierId: 'supplier_sonic', supplierName: 'Sonic Line Events', email: 'sonic@example.test' },
      { supplierId: 'supplier_atlas', supplierName: 'Atlas Sound', email: 'atlas@example.test' },
    ];
    const harness = createHarness({ rows: [requirement], storedUpload: upload, suppliers });
    const sonic = { id: 'usr_sonic', role: 'supplier', name: 'Sonic', email: 'sonic@example.test', explicit: true, verified: true };

    const response = await harness.service.bindRequirementUpload(eventId, requirement.key, { objectId: upload.id }, sonic as never);

    expect(harness.documents).toHaveLength(1);
    expect(response).toMatchObject({ key: 'insurance_certificate', status: 'submitted', uploadedObjectId: 'obj_sonic', overdue: false });
    expect(response).not.toHaveProperty('supplierFulfilments');
    expect(response).not.toHaveProperty('notes');
    expect(JSON.stringify(response)).not.toMatch(/supplier_atlas|Atlas Sound/);
  });

  it('refuses a supplier without a selected booking before any upload is bound, and still binds for a selected one', async () => {
    const requirement = { id: 'freq_3', eventId, key: 'insurance_certificate', label: 'Insurance certificate', ownerRole: 'supplier', visibleToRoles: ['pmcm-admin', 'supplier'], required: true, dueAt: null, sourceWorkflow: 'custom', isCustom: true, notes: null, revision: 1, updatedBy: 'pmcm' };
    const upload = { id: 'obj_sonic', eventId, logicalTarget: 'supplier-requirement:insurance_certificate:123e4567-e89b-42d3-a456-426614174000', ownerRecordType: 'supplier', ownerRecordId: 'supplier_sonic', usage: 'supplier_document', lifecycleState: 'stored', originalFileName: 'insurance.pdf', contentType: 'application/pdf', declaredByteSize: 100, uploaderActorId: 'usr_sonic', uploaderActorRole: 'supplier' };
    const sonic = { id: 'usr_sonic', role: 'supplier', name: 'Sonic', email: 'sonic@example.test', explicit: true, verified: true };
    const atlas = { supplierId: 'supplier_atlas', supplierName: 'Atlas Sound', email: 'atlas@example.test' };

    // Sonic has an open quote on the event but no selected booking.
    const unselected = createHarness({ rows: [requirement], storedUpload: upload, suppliers: [atlas], openSuppliers: [{ supplierId: 'supplier_sonic', supplierName: 'Sonic Line Events', email: 'sonic@example.test' }] });
    await expect(unselected.service.bindRequirementUpload(eventId, requirement.key, { objectId: upload.id }, sonic as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(unselected.documents).toHaveLength(0);
    expect(unselected.storedRequirementUploads.findStoredRequirementUpload).not.toHaveBeenCalled();
    expect(unselected.accessPolicy.recordForbiddenAccess).toHaveBeenCalledWith(expect.objectContaining({ supplierId: 'supplier_sonic' }), 'fulfil file requirement without a selected booking', eventId);

    // Sonic has no quote on the event at all, so its supplier id never resolves.
    const absent = createHarness({ rows: [requirement], storedUpload: upload, suppliers: [atlas] });
    await expect(absent.service.bindRequirementUpload(eventId, requirement.key, { objectId: upload.id }, sonic as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(absent.documents).toHaveLength(0);

    const selected = createHarness({ rows: [requirement], storedUpload: upload, suppliers: [{ ...atlas }, { supplierId: 'supplier_sonic', supplierName: 'Sonic Line Events', email: 'sonic@example.test' }] });
    await expect(selected.service.bindRequirementUpload(eventId, requirement.key, { objectId: upload.id }, sonic as never)).resolves.toMatchObject({ key: requirement.key, uploadedObjectId: 'obj_sonic' });
    expect(selected.documents).toHaveLength(1);
    const wrongRequirement = createHarness({ rows: [requirement], storedUpload: { ...upload, logicalTarget: 'supplier-requirement:other:123e4567-e89b-42d3-a456-426614174000' }, suppliers: [{ supplierId: 'supplier_sonic', supplierName: 'Sonic Line Events', email: 'sonic@example.test' }] });
    await expect(wrongRequirement.service.bindRequirementUpload(eventId, requirement.key, { objectId: upload.id }, sonic as never)).rejects.toThrow('different file requirement');
    expect(wrongRequirement.documents).toHaveLength(0);
  });

  it('rejects unselected targets and prevents an unassigned selected supplier binding a file', async () => {
    const requirement = { ...insuranceRequirement(), targetSupplierIds: [atlas.supplierId] };
    const upload = { id: 'obj_sonic', eventId, logicalTarget: 'supplier-requirement:insurance_certificate:123e4567-e89b-42d3-a456-426614174000', ownerRecordType: 'supplier', ownerRecordId: sonic.supplierId, usage: 'supplier_document', lifecycleState: 'stored', originalFileName: 'insurance.pdf', contentType: 'application/pdf', declaredByteSize: 100, uploaderActorId: 'usr_sonic', uploaderActorRole: 'supplier' };
    const harness = createHarness({ rows: [requirement], storedUpload: upload, suppliers: [atlas, sonic] });
    await expect(harness.service.updateRequirement(eventId, requirement.key, { targetSupplierIds: ['unknown'] }, pmcm)).rejects.toBeInstanceOf(BadRequestException);
    const actor = { id: 'usr_sonic', role: 'supplier', name: 'Sonic', email: sonic.email, explicit: true, verified: true };
    await expect(harness.service.bindRequirementUpload(eventId, requirement.key, { objectId: upload.id }, actor as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(harness.documents).toHaveLength(0);
  });

  it('allows PMCM to reject the current supplier upload with a reason and refuses stale or supplier reviews', async () => {
    const requirement = { ...insuranceRequirement(), targetSupplierIds: [sonic.supplierId] };
    const upload = { id: 'obj_sonic', eventId, logicalTarget: 'supplier-requirement:insurance_certificate:123e4567-e89b-42d3-a456-426614174000', ownerRecordType: 'supplier', ownerRecordId: sonic.supplierId, usage: 'supplier_document', lifecycleState: 'stored', originalFileName: 'insurance.pdf', contentType: 'application/pdf', declaredByteSize: 100, uploaderActorId: 'usr_sonic', uploaderActorRole: 'supplier' };
    const harness = createHarness({ rows: [requirement], storedUpload: upload, suppliers: [sonic] });
    const actor = { id: 'usr_sonic', role: 'supplier', name: 'Sonic', email: sonic.email, explicit: true, verified: true };
    const submitted = await harness.service.bindRequirementUpload(eventId, requirement.key, { objectId: upload.id }, actor as never);
    const documentId = submitted.uploadedAssetId!;
    await expect(harness.service.reviewSupplierRequirement(eventId, requirement.key, { documentId, decision: 'approve' }, actor as never)).rejects.toBeInstanceOf(ForbiddenException);
    const reviewed = await harness.service.reviewSupplierRequirement(eventId, requirement.key, { documentId, decision: 'reject', reason: 'Policy has expired' }, pmcm);
    expect(reviewed.supplierFulfilments?.[0]).toMatchObject({ status: 'missing', reviewReason: 'Policy has expired' });
    expect(harness.documents[0]).toMatchObject({ status: 'rejected', validationStatus: 'accepted' });
    await expect(harness.service.reviewSupplierRequirement(eventId, requirement.key, { documentId, decision: 'approve' }, pmcm)).rejects.toBeInstanceOf(ConflictException);
  });

  it('applies PMCM-configured event templates idempotently and offsets due dates from the event date', async () => {
    const harness = createHarness();
    await harness.service.upsertRequirementTemplate({ eventType: 'Wedding', requirements: [
      { key: 'venue_permit', label: 'Venue permit', ownerRole: 'client', visibleToRoles: ['pmcm-admin', 'client'], required: true, dueOffsetDays: 30 },
      { key: 'supplier_insurance', label: 'Supplier insurance', ownerRole: 'supplier', visibleToRoles: ['pmcm-admin', 'supplier'], required: true },
    ] }, pmcm);
    const first = await harness.service.applyRequirementTemplate(eventId, pmcm);
    const second = await harness.service.applyRequirementTemplate(eventId, pmcm);
    expect(first.createdKeys).toEqual(['venue_permit', 'supplier_insurance']);
    expect(first.eventType).toBe('wedding');
    expect(second.createdKeys).toEqual([]);
    expect(second.skippedExistingCount).toBe(2);
    expect(harness.rows.find((row) => row.key === 'venue_permit')?.dueAt.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(harness.rows).toHaveLength(2);
  });
});
