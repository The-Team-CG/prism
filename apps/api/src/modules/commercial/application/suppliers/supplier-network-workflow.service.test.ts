import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole, SupplierVerificationStatus, WorkflowCommandService } from '@prism/kernel/event-core';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import type { PrismVerifiedEventActor } from '@prism/types';
import { SupplierNetworkWorkflowService } from './supplier-network-workflow.service';

function createService(overrides: {
  documentVault?: Record<string, unknown>;
  workflowCommandService?: WorkflowCommandService;
  workflowCommandServiceFactory?: (prisma: any) => WorkflowCommandService;
} = {}) {
  const request = {
    id: 'qr_sonic',
    eventId: 'evt_sample',
    supplierId: 'sup_sonicline',
    categoryId: 'cat_technicals',
    supplierName: 'Sonic Line Events',
    category: 'Technicals',
    message: 'Summit quote request.',
    dueDate: null,
    accessToken: 'supplier-token',
    confidentialBid: false,
    createdAt: new Date('2026-10-02T09:00:00.000Z'),
    eventDayVerificationStatus: SupplierVerificationStatus.SelfReported,
    eventDayVerifiedAt: null,
    eventDayVerifiedBy: null,
    eventDayVerificationNotes: '',
    eventDayStatus: 'not_started',
    eventDayStatusAt: null as Date | null,
    eventDayNotes: '',
    status: 'pending',
    assignmentStatus: 'pending_confirmation',
    assignmentConfirmedAt: null,
    readinessStatus: 'not_requested',
    readinessConfirmedAt: null,
    readinessNotes: '',
    statusPhotoFileName: null,
    contractDocumentId: null,
  };
  let schedule: Record<string, unknown> | null = null;
  const audit = vi.fn();
  const notify = vi.fn(async () => ({}));
  const suppliers = {
    listSuppliers: vi.fn(async () => [
      { id: 'sup_sonicline', name: 'Sonic Line Events', email: 'supplier@example.com' },
    ]),
  };
  const eventAccessPolicyService = new EventAccessPolicyService({ write: vi.fn() } as any);
  const prisma = {
    $queryRaw: vi.fn(async () => []),
    opsSupplier: { findUnique: vi.fn(async () => ({ email: 'supplier@example.com' })) },
    opsEvent: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === 'evt_sample' ? { id: 'evt_sample', archived: false } : null)),
    },
    opsSupplierQuoteRequest: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === request.id ? request : null)),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(request, data)),
      findUniqueOrThrow: vi.fn(async () => request),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; status?: string; assignmentStatus?: string | null; eventDayStatus?: string }; data: Record<string, unknown> }) => {
        if (where.status && request.status !== where.status) return { count: 0 };
        if (Object.prototype.hasOwnProperty.call(where, 'assignmentStatus') && request.assignmentStatus !== where.assignmentStatus) return { count: 0 };
        if (where.eventDayStatus && request.eventDayStatus !== where.eventDayStatus) return { count: 0 };
        Object.assign(request, data);
        return { count: 1 };
      }),
    },
    opsSupplierSchedule: {
      findUnique: vi.fn(async () => schedule),
      upsert: vi.fn(async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        if (!schedule) schedule = { ...create, status: 'planned', revision: 1, acknowledgedRevision: null };
        else schedule = { ...schedule, ...update, revision: Number(schedule.revision) + 1, acknowledgedRevision: null };
        schedule.createdAt ??= new Date('2026-10-02T09:00:00.000Z');
        schedule.updatedAt = new Date('2026-10-02T09:00:00.000Z');
        return schedule;
      }),
    },
    $transaction: vi.fn(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => callback(prisma as unknown as Record<string, unknown>)),
  };
  const documentVault = overrides.documentVault ?? {};
  const service = new SupplierNetworkWorkflowService(
    prisma as any,
    suppliers as any,
    {} as any,
    { write: audit } as any,
    eventAccessPolicyService,
    overrides.workflowCommandService ?? overrides.workflowCommandServiceFactory?.(prisma) ?? new WorkflowCommandService(),
    {} as any,
    { queue: vi.fn(async () => ({})) } as any,
    documentVault as any,
    { findOperationsEvent: vi.fn(async (eventId: string) => ({ id: eventId, archived: false })) } as any,
    { write: notify } as any,
  );
  return { service, prisma, audit, notify, request, suppliers, documentVault, getSchedule: () => schedule };
}

function createCommandReceiptStore() {
  const receipts = new Map<string, { id: string; payloadHash: string | null; result: unknown; key: Record<string, unknown> }>();
  const receiptKey = (key: Record<string, unknown>) => JSON.stringify({
    commandName: key.commandName,
    idempotencyKey: key.idempotencyKey,
    actorId: key.actorId,
    eventScope: key.eventScope,
  });
  return {
    find: vi.fn(async (key: Record<string, unknown>) => receipts.get(receiptKey(key)) ?? null),
    create: vi.fn(async (input: Record<string, unknown>) => {
      const entry = { id: `receipt_${receipts.size + 1}`, payloadHash: input.payloadHash as string | null, result: null, key: input };
      receipts.set(receiptKey(input), entry);
      return { id: entry.id };
    }),
    complete: vi.fn(async (id: string, result: unknown) => {
      for (const [key, entry] of receipts) {
        if (entry.id === id) receipts.set(key, { ...entry, result });
      }
    }),
  };
}

describe('SupplierNetworkWorkflowService', () => {
  it('registers a supplier contract once and rejects changed-content reuse of the same key', async () => {
    const request = {
      id: 'qr_sonic',
      eventId: 'evt_sample',
      supplierId: 'sup_sonicline',
      categoryId: 'cat_technicals',
      supplierName: 'Sonic Line Events',
      category: 'Technicals',
      message: 'Summit quote request.',
      dueDate: null,
      accessToken: 'supplier-token',
      confidentialBid: false,
      createdAt: new Date('2026-10-02T09:00:00.000Z'),
      eventDayVerificationStatus: SupplierVerificationStatus.SelfReported,
      eventDayVerifiedAt: null,
      eventDayVerifiedBy: 'PMCM-SENTINEL-verifier',
      eventDayVerificationNotes: 'PMCM-SENTINEL-note',
      eventDayStatus: 'not_started',
      eventDayStatusAt: null,
      eventDayNotes: '',
      status: 'selected',
      assignmentStatus: 'confirmed',
      assignmentConfirmedAt: null,
      readinessStatus: 'not_requested',
      readinessConfirmedAt: null,
      readinessNotes: 'Supplier-authored readiness note.',
      statusPhotoFileName: null,
      contractDocumentId: null,
    };
    const documentVault = {
      validateUploadMetadata: vi.fn((input: { fileName: string }) => ({
        originalFileName: input.fileName,
        generatedFileName: 'safe-contract.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        storageBucket: 'document-vault',
        storageKey: 'events/evt_sample/supplier-contracts/safe-contract.pdf',
        validationStatus: 'accepted',
      })),
      registerDocument: vi.fn(async (input: { eventId: string; documentKind: string; fileName: string; status: string }) => ({
        id: 'doc_contract', eventId: input.eventId, kind: input.documentKind as 'supplier_contract',
        fileName: input.fileName, status: input.status,
      })),
    };
    const receiptStore = createCommandReceiptStore();
    const { service, prisma, audit } = createService({
      documentVault,
      workflowCommandServiceFactory: (transactionPrisma) => {
        const transactionRunner = {
          run: (work: (context: { prisma: unknown; correlationId: string; actorId?: string }) => Promise<unknown>, command: { correlationId?: string; actorId?: string } = {}) =>
            transactionPrisma.$transaction((tx: unknown) => work({ prisma: tx, correlationId: command.correlationId ?? 'corr_supplier_test', actorId: command.actorId })),
        };
        return new WorkflowCommandService(transactionRunner as never, receiptStore as never);
      },
    });
    prisma.opsSupplierQuoteRequest.findUnique.mockResolvedValue(request as never);
    prisma.opsSupplierQuoteRequest.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => Object.assign(request, data) as never);
    const actor = {
      id: 'supplier_session', role: OpsUserRole.Supplier, name: 'Sonic Line Events',
      email: 'supplier@example.com', supplierId: 'sup_sonicline', explicit: true, verified: true,
    };
    const verifiedActor: PrismVerifiedEventActor = {
      id: actor.id, actorId: actor.id, role: OpsUserRole.Supplier, actorRole: OpsUserRole.Supplier,
      email: actor.email, actorEmail: actor.email, name: actor.name, actorName: actor.name,
      supplierId: actor.supplierId, eventId: 'evt_sample', expiresAt: '2026-10-04T12:00:00.000Z',
    };
    const input = { fileName: 'contract.pdf', mimeType: 'application/pdf', sizeBytes: 2048, idempotencyKey: 'contract-retry-1' };

    const first = await service.uploadSupplierContract('qr_sonic', input, actor, verifiedActor);
    const replay = await service.uploadSupplierContract('qr_sonic', input, actor, verifiedActor);
    expect(first.contractDocumentId).toBe('doc_contract');
    expect(replay.contractDocumentId).toBe('doc_contract');
    expect(JSON.stringify(first)).not.toContain('PMCM-SENTINEL');
    expect(documentVault.registerDocument).toHaveBeenCalledTimes(1);
    expect(prisma.opsSupplierQuoteRequest.update).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledTimes(1);

    // A receipt written before the projection fix stores PMCM review fields; a same-key retry must not return them.
    const receiptId = (await receiptStore.create.mock.results[0]!.value as { id: string }).id;
    await receiptStore.complete(receiptId, {
      ...first,
      eventDayVerifiedBy: 'PMCM-SENTINEL-verifier',
      eventDayVerificationNotes: 'PMCM-SENTINEL-note',
    });
    const legacyReplay = await service.uploadSupplierContract('qr_sonic', input, actor, verifiedActor);
    expect(JSON.stringify(legacyReplay)).not.toContain('PMCM-SENTINEL');
    expect(legacyReplay).not.toHaveProperty('eventDayVerifiedBy');
    expect(legacyReplay).not.toHaveProperty('eventDayVerificationNotes');
    expect(legacyReplay.contractDocumentId).toBe('doc_contract');
    expect(legacyReplay.readinessNotes).toBe('Supplier-authored readiness note.');
    expect(documentVault.registerDocument).toHaveBeenCalledTimes(1);
    expect(prisma.opsSupplierQuoteRequest.update).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledTimes(1);

    await expect(service.uploadSupplierContract(
      'qr_sonic', { ...input, fileName: 'changed-contract.pdf' }, actor, verifiedActor,
    )).rejects.toThrow(/reused for different content/i);
    expect(documentVault.registerDocument).toHaveBeenCalledTimes(1);
  });

  it('keeps PMCM verification notes and verifier identity out of supplier command responses', async () => {
    const { service, request } = createService();
    Object.assign(request, {
      status: 'selected',
      eventDayVerificationStatus: SupplierVerificationStatus.Verified,
      eventDayVerifiedAt: new Date('2026-10-02T10:00:00.000Z'),
      eventDayVerifiedBy: 'PMCM-SENTINEL-verifier',
      eventDayVerificationNotes: 'PMCM-SENTINEL-note',
    });
    const supplier = {
      name: 'Sonic Line Events', role: OpsUserRole.Supplier, supplierId: 'sup_sonicline',
      email: 'supplier@example.com', explicit: true, verified: true,
    };

    const assigned = await service.confirmSupplierAssignment('qr_sonic', supplier);
    const ready = await service.confirmSupplierReadiness('qr_sonic', { notes: 'Supplier-authored readiness note.' }, supplier);
    const eventStatus = await service.updateSupplierEventStatus('qr_sonic', { status: 'arrived', notes: 'At dock.' }, supplier);

    for (const response of [assigned, ready, eventStatus]) {
      expect(JSON.stringify(response)).not.toContain('PMCM-SENTINEL');
      expect(response).not.toHaveProperty('eventDayVerifiedBy');
      expect(response).not.toHaveProperty('eventDayVerificationNotes');
    }
    // Supplier-authored readiness notes and the supplier's own status stay visible to the supplier.
    expect(ready.readinessNotes).toBe('Supplier-authored readiness note.');
    expect(eventStatus.eventDayStatus).toBe('arrived');
  });

  it('accepts supplier event-day status only in order, replays the current status, and rejects skips and backward steps', async () => {
    const { service, request, prisma, audit } = createService();
    Object.assign(request, { status: 'selected', assignmentStatus: 'confirmed', readinessStatus: 'confirmed' });
    const supplier = {
      name: 'Sonic Line Events', role: OpsUserRole.Supplier, supplierId: 'sup_sonicline',
      email: 'supplier@example.com', explicit: true, verified: true,
    };
    const report = (status: 'arrived' | 'set_up_ready' | 'done_leaving') =>
      service.updateSupplierEventStatus('qr_sonic', { status }, supplier);

    await expect(report('done_leaving')).rejects.toThrow(/cannot skip ahead to "done leaving"\. Report "arrived" next/);
    await expect(report('set_up_ready')).rejects.toThrow(BadRequestException);
    expect(request.eventDayStatus).toBe('not_started');

    expect((await report('arrived')).eventDayStatus).toBe('arrived');
    await expect(report('done_leaving')).rejects.toThrow(/Report "set-up ready" next/);

    const writesBeforeReplay = prisma.opsSupplierQuoteRequest.updateMany.mock.calls.length;
    const auditsBeforeReplay = audit.mock.calls.length;
    expect((await report('arrived')).eventDayStatus).toBe('arrived');
    expect(prisma.opsSupplierQuoteRequest.updateMany.mock.calls).toHaveLength(writesBeforeReplay);
    expect(audit.mock.calls).toHaveLength(auditsBeforeReplay);

    expect((await report('set_up_ready')).eventDayStatus).toBe('set_up_ready');
    await expect(report('arrived')).rejects.toThrow(/cannot move backward to "arrived"/);
    expect((await report('done_leaving')).eventDayStatus).toBe('done_leaving');
    await expect(report('set_up_ready')).rejects.toThrow(/already complete and cannot move back/);
  });


  it.each(['supplier', 'pmcm'])('refuses a stale %s status write without overwriting a concurrent correction or auditing it', async (kind) => {
    const { service, request, prisma, audit } = createService();
    Object.assign(request, { status: 'selected', assignmentStatus: 'confirmed', readinessStatus: 'confirmed', eventDayStatus: 'arrived' });
    const update = prisma.opsSupplierQuoteRequest.updateMany.getMockImplementation();
    if (!update) throw new Error('Missing fixture update behavior');
    prisma.opsSupplierQuoteRequest.updateMany.mockImplementationOnce(async (input) => {
      request.eventDayStatus = 'done_leaving';
      return update(input);
    });
    const supplier = { name: 'Sonic Line Events', role: OpsUserRole.Supplier, supplierId: 'sup_sonicline', email: 'supplier@example.com', explicit: true, verified: true };
    const pmcm = { id: 'pmcm_1', name: 'PMCM Admin', role: OpsUserRole.PmcmAdmin, explicit: true, verified: true };
    const command = kind === 'supplier'
      ? service.updateSupplierEventStatus('qr_sonic', { status: 'set_up_ready' }, supplier)
      : service.correctSupplierEventStatus('evt_sample', 'qr_sonic', { status: 'not_started', reason: 'Correct mistaken arrival' }, pmcm);
    await expect(command).rejects.toBeInstanceOf(ConflictException);
    expect(request.eventDayStatus).toBe('done_leaving');
    expect(audit).not.toHaveBeenCalled();
  });

  it('lets PMCM correct a supplier status in either direction with a reason, and the supplier continues from it', async () => {
    const { service, request, prisma, audit, notify } = createService();
    Object.assign(request, { status: 'selected', assignmentStatus: 'confirmed', readinessStatus: 'confirmed', eventDayStatus: 'done_leaving' });
    const supplier = {
      name: 'Sonic Line Events', role: OpsUserRole.Supplier, supplierId: 'sup_sonicline',
      email: 'supplier@example.com', explicit: true, verified: true,
    };
    const pmcm = { id: 'pmcm_1', name: 'PMCM Admin', email: 'admin@pmcm.test', role: OpsUserRole.PmcmAdmin, explicit: true, verified: true };
    const correct = (status: 'not_started' | 'arrived' | 'set_up_ready' | 'done_leaving', reason = 'Reported by mistake') =>
      service.correctSupplierEventStatus('evt_sample', 'qr_sonic', { status, reason }, pmcm);

    const back = await correct('arrived');
    expect(back.eventDayStatus).toBe('arrived');
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'PMCM Admin',
        metadata: expect.objectContaining({ previousStatus: 'done_leaving', status: 'arrived', reason: 'Reported by mistake' }),
      }),
      undefined,
    );
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: 'supplier@example.com', message: expect.stringContaining('Reported by mistake') }),
      undefined,
    );

    // The supplier's own rule still applies, continuing from the corrected status.
    await expect(service.updateSupplierEventStatus('qr_sonic', { status: 'done_leaving' }, supplier)).rejects.toThrow(/Report "set-up ready" next/);
    expect((await service.updateSupplierEventStatus('qr_sonic', { status: 'set_up_ready' }, supplier)).eventDayStatus).toBe('set_up_ready');

    // PMCM may also move forward, past the supplier's order, or reset to not started.
    expect((await correct('done_leaving')).eventDayStatus).toBe('done_leaving');
    expect((await correct('not_started')).eventDayStatus).toBe('not_started');
    await expect(service.updateSupplierEventStatus('qr_sonic', { status: 'set_up_ready' }, supplier)).rejects.toThrow(/Report "arrived" next/);

    const writes = prisma.opsSupplierQuoteRequest.update.mock.calls.length;
    const audits = audit.mock.calls.length;
    const notifications = notify.mock.calls.length;
    expect((await correct('not_started', 'Same again')).eventDayStatus).toBe('not_started');
    expect(prisma.opsSupplierQuoteRequest.update.mock.calls).toHaveLength(writes);
    expect(audit.mock.calls).toHaveLength(audits);
    expect(notify.mock.calls).toHaveLength(notifications);
  });

  it('refuses a status correction without a reason, from non-PMCM roles, or for another event', async () => {
    const { service, request, prisma, notify } = createService();
    Object.assign(request, { status: 'selected', assignmentStatus: 'confirmed', readinessStatus: 'confirmed', eventDayStatus: 'arrived' });
    const pmcm = { id: 'pmcm_1', name: 'PMCM Admin', email: 'admin@pmcm.test', role: OpsUserRole.PmcmAdmin, explicit: true, verified: true };

    await expect(service.correctSupplierEventStatus('evt_sample', 'qr_sonic', { status: 'not_started', reason: '   ' }, pmcm)).rejects.toThrow(/reason is required/);
    await expect(service.correctSupplierEventStatus('evt_other', 'qr_sonic', { status: 'not_started', reason: 'Wrong event' }, pmcm)).rejects.toThrow('Supplier quote request not found');
    for (const role of [OpsUserRole.Supplier, OpsUserRole.Client, OpsUserRole.Guest, OpsUserRole.Coordinator]) {
      await expect(
        service.correctSupplierEventStatus('evt_sample', 'qr_sonic', { status: 'not_started', reason: 'Nope' }, { name: 'Someone', role, explicit: true, verified: true }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(request.eventDayStatus).toBe('arrived');
    expect(prisma.opsSupplierQuoteRequest.update).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('lets a supplier report arrival after the automatic late flag', async () => {
    const { service, request } = createService();
    Object.assign(request, { status: 'selected', assignmentStatus: 'confirmed', readinessStatus: 'confirmed', eventDayStatus: 'late' });
    const supplier = {
      name: 'Sonic Line Events', role: OpsUserRole.Supplier, supplierId: 'sup_sonicline',
      email: 'supplier@example.com', explicit: true, verified: true,
    };

    const updated = await service.updateSupplierEventStatus('qr_sonic', { status: 'arrived' }, supplier);

    expect(updated.eventDayStatus).toBe('arrived');
  });

  it('uses the same command transaction for document registration and commercial linking', async () => {
    const { service, prisma, audit, request, documentVault } = createService({
      documentVault: {
        validateUploadMetadata: vi.fn(() => ({
          originalFileName: 'contract.pdf', generatedFileName: 'safe-contract.pdf', mimeType: 'application/pdf',
          sizeBytes: 2048, storageBucket: 'document-vault', storageKey: 'events/evt_sample/contract.pdf', validationStatus: 'accepted',
        })),
        registerDocument: vi.fn(async () => ({ id: 'doc_contract', eventId: 'evt_sample', kind: 'supplier_contract' as const, status: 'submitted', fileName: 'contract.pdf' })),
      },
      workflowCommandServiceFactory: (transactionPrisma) => new WorkflowCommandService({
        run: (
          work: (context: { prisma: unknown; correlationId: string; actorId?: string }) => Promise<unknown>,
          command: { correlationId?: string; actorId?: string } = {},
        ) => transactionPrisma.$transaction((tx: unknown) => work({
          prisma: tx,
          correlationId: command.correlationId ?? 'corr_supplier_test',
          actorId: command.actorId,
        })),
      } as never),
    });
    const actor = {
      id: 'supplier_session', role: OpsUserRole.Supplier, name: 'Sonic Line Events',
      email: 'supplier@example.com', supplierId: 'sup_sonicline', explicit: true, verified: true,
    };
    const verifiedActor: PrismVerifiedEventActor = {
      id: actor.id, actorId: actor.id, role: OpsUserRole.Supplier, actorRole: OpsUserRole.Supplier,
      email: actor.email, actorEmail: actor.email, name: actor.name, actorName: actor.name,
      supplierId: actor.supplierId, eventId: 'evt_sample', expiresAt: '2026-10-04T12:00:00.000Z',
    };
    prisma.opsSupplierQuoteRequest.update.mockRejectedValueOnce(new Error('commercial link failed'));

    await expect(service.uploadSupplierContract(
      'qr_sonic', { fileName: 'contract.pdf', mimeType: 'application/pdf', sizeBytes: 2048, idempotencyKey: 'contract-failure-1' }, actor, verifiedActor,
    )).rejects.toThrow('commercial link failed');
    expect(documentVault.registerDocument).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: request.eventId, documentKind: 'supplier_contract' }),
      expect.objectContaining({ prisma }),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(audit).not.toHaveBeenCalled();
  });

  it('verifies supplier event-day status with the trusted actor identity', async () => {
    const { service, prisma, audit } = createService();

    const input = { verificationStatus: SupplierVerificationStatus.Verified, verifiedBy: 'Ms. Mys', notes: 'Setup checked.' };
    const updated = await service.verifySupplierEventStatus(
      'evt_sample',
      'qr_sonic',
      input,
      { name: 'PMCM Admin', role: OpsUserRole.PmcmAdmin, explicit: true },
    );

    expect(updated.eventDayVerificationStatus).toBe(SupplierVerificationStatus.Verified);
    expect(updated.eventDayVerifiedBy).toBe('PMCM Admin');
    expect(updated.eventDayVerifiedBy).not.toBe('Ms. Mys');
    expect(prisma.opsSupplierQuoteRequest.findUnique).toHaveBeenCalledWith({ where: { id: 'qr_sonic' } });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_sample',
        actor: 'PMCM Admin',
        action: 'Marked supplier setup verified: Sonic Line Events',
        actorRole: OpsUserRole.PmcmAdmin,
        affectedId: 'qr_sonic',
        metadata: { verificationStatus: SupplierVerificationStatus.Verified, verifiedBy: 'PMCM Admin', notes: 'Setup checked.' },
      }),
      undefined,
    );
  });

  it('rejects unsupported supplier event-day verification statuses before writing', async () => {
    const { service, prisma } = createService();

    await expect(
      service.verifySupplierEventStatus(
        'evt_sample',
        'qr_sonic',
        { verificationStatus: 'unknown' } as never,
        { name: 'PMCM Admin', role: OpsUserRole.PmcmAdmin, explicit: true },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.opsSupplierQuoteRequest.update).not.toHaveBeenCalled();
  });
  it('denies client and guest actors from mutating supplier assignments', async () => {
    const { service, prisma, suppliers } = createService();

    await expect(
      service.confirmSupplierAssignment('qr_sonic', {
        name: 'Ana Reyes',
        role: OpsUserRole.Client,
        clientName: 'Ana Reyes',
        explicit: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.confirmSupplierAssignment('qr_sonic', {
        name: 'Guest User',
        role: OpsUserRole.Guest,
        explicit: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(suppliers.listSuppliers).not.toHaveBeenCalled();
    expect(prisma.opsSupplierQuoteRequest.update).not.toHaveBeenCalled();
  });

  it('rejects confirmation before PMCM selects the supplier', async () => {
    const { service, request, prisma } = createService();
    await expect(service.confirmSupplierAssignment('qr_sonic', {
      name: 'Sonic Line Events', role: OpsUserRole.Supplier, supplierId: 'sup_sonicline', explicit: true,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.opsSupplierQuoteRequest.update).not.toHaveBeenCalled();
    request.status = 'selected';
  });

  it('rejects confirmation when the selected state changes after validation', async () => {
    const { service, request, prisma } = createService();
    request.status = 'selected';
    const findUnique = prisma.opsSupplierQuoteRequest.findUnique as ReturnType<typeof vi.fn>;
    findUnique.mockImplementationOnce(async () => {
      const snapshot = { ...request };
      request.status = 'withdrawn';
      return snapshot;
    });

    await expect(service.confirmSupplierAssignment('qr_sonic', {
      name: 'Sonic Line Events', role: OpsUserRole.Supplier, supplierId: 'sup_sonicline', explicit: true,
    })).rejects.toThrow(/changed before confirmation/);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.opsSupplierQuoteRequest.updateMany).not.toHaveBeenCalled();
  });

  it('clears an automatic late flag when PMCM changes the ingress schedule', async () => {
    const { service, request, prisma, audit } = createService();
    request.status = 'selected';
    request.assignmentStatus = 'confirmed';
    request.eventDayStatus = 'late';
    request.eventDayStatusAt = new Date('2026-10-02T10:15:00.000Z');

    const schedule = await service.createSupplierSchedule(
      'evt_sample',
      {
        requestId: 'qr_sonic',
        ingressAt: '2026-10-02T11:00:00.000Z',
        egressAt: '2026-10-02T14:00:00.000Z',
      },
      { name: 'PMCM Admin', role: OpsUserRole.PmcmAdmin, explicit: true },
    );

    expect(schedule).toMatchObject({
      requestId: 'qr_sonic',
      supplierName: 'Sonic Line Events',
      status: 'planned',
      ingressAt: '2026-10-02T11:00:00.000Z',
      egressAt: '2026-10-02T14:00:00.000Z',
    });
    expect(request).toMatchObject({ eventDayStatus: 'not_started', eventDayStatusAt: null });
    expect(prisma.opsSupplierQuoteRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'qr_sonic', eventDayStatus: 'late' },
      data: { eventDayStatus: 'not_started', eventDayStatusAt: null },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ lateFlagReset: true }) }),
      expect.anything(),
    );
  });

  it('leaves an acknowledged schedule revision unchanged when PMCM republishes identical details', async () => {
    const { service, request, prisma, audit, getSchedule } = createService();
    request.status = 'selected';
    request.assignmentStatus = 'confirmed';
    const input = {
      requestId: 'qr_sonic',
      ingressAt: '2026-10-02T11:00:00.000Z',
      egressAt: '2026-10-02T14:00:00.000Z',
      location: 'Loading entrance',
      notes: 'Use service lift',
    };
    const actor = { name: 'PMCM Admin', role: OpsUserRole.PmcmAdmin, explicit: true };
    await service.createSupplierSchedule('evt_sample', input, actor);
    const acknowledgedSchedule = getSchedule();
    expect(acknowledgedSchedule).not.toBeNull();
    Object.assign(acknowledgedSchedule!, { acknowledgedRevision: 1, acknowledgedAt: new Date('2026-10-02T10:00:00.000Z') });

    const repeat = await service.createSupplierSchedule('evt_sample', input, actor);

    expect(repeat).toMatchObject({ supplierName: request.supplierName, status: 'planned' });
    expect(getSchedule()).toMatchObject({ revision: 1, acknowledgedRevision: 1 });
    expect(prisma.opsSupplierSchedule.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.opsSupplierQuoteRequest.updateMany).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledTimes(1);
  });
});
