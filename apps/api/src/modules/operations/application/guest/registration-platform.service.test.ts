import { BadRequestException, ConflictException } from '@nestjs/common';
import type { OpsRegistrationPlatform } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import type { PrismaService } from '@prism/kernel/database';
import { RegistrationPlatformService } from './registration-platform.service';

const actor = { role: OpsUserRole.PmcmAdmin, name: 'Maxine', explicit: true };
function createService(overrides: Partial<OpsRegistrationPlatform> = {}) {
  let existing: OpsRegistrationPlatform = {
    id: 'reg_1', eventId: 'evt_sample', platformType: 'xperto', status: 'configuring',
    supplierId: 'sup_reg', expectedPaxMin: 100, expectedPaxMax: 200, setupConfirmedAt: null,
    setupNotes: '', headcountSource: '', importedHeadcount: 0, importedFileName: null,
    importedAt: null, createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
  const event = {
    id: 'evt_sample', eventName: 'Conference', eventDate: new Date('2026-09-01T00:00:00Z'),
    status: 'archived', archived: true, actualEndedAt: new Date('2026-09-07T12:00:00Z') as Date | null,
    walkInPolicy: 'closed', walkInThreshold: 200,
  };
  const hooks = { beforeTransaction: () => {} };
  const database = {
    opsRegistrationPlatform: {
      findUnique: vi.fn(async () => existing),
      create: vi.fn(async ({ data }: { data: Partial<OpsRegistrationPlatform> }) => (existing = { ...existing, ...data } as OpsRegistrationPlatform)),
      update: vi.fn(async ({ data }: { data: Partial<OpsRegistrationPlatform> }) => (existing = { ...existing, ...data })),
      updateMany: vi.fn(async ({ where, data }: { where: { status: string }; data: Partial<OpsRegistrationPlatform> }) => {
        if (where.status !== existing.status) return { count: 0 };
        existing = { ...existing, ...data };
        return { count: 1 };
      }),
    },
  };
  const prisma = { ...database, $transaction: async <T>(work: (tx: typeof database) => Promise<T>) => { hooks.beforeTransaction(); return work(database); } };
  const eventReferences = { findOperationsEvent: vi.fn(async () => ({ ...event })) };
  let supplier = { id: 'sup_reg', registrationCategory: true, categoryActive: true, selectedForEvent: true };
  const supplierReferences = { findRegistrationSupplier: vi.fn(async () => ({ ...supplier })) };
  const auditWriter = { write: vi.fn(async () => undefined) };
  const workflow = new WorkflowCommandService(new PrismTransactionRunner(prisma as unknown as PrismaService));
  const service = new RegistrationPlatformService(
    prisma as unknown as PrismaService,
    auditWriter as never,
    workflow,
    eventReferences as never,
    supplierReferences as never,
  );
  return { service, prisma, database, auditWriter, hooks, event, eventReferences, supplierReferences, setSupplier: (value: typeof supplier) => { supplier = value; } };
}

describe('RegistrationPlatformService transaction validation', () => {
  it('stamps setup once when entering live and retains it through closure', async () => {
    const { service, prisma } = createService();
    const live = await service.update('evt_sample', { status: 'live' }, actor);
    expect(live.setupConfirmedAt).toBeInstanceOf(Date);
    const repeated = await service.update('evt_sample', { status: 'live' }, actor);
    const closed = await service.update('evt_sample', { status: 'closed' }, actor);
    expect(repeated.setupConfirmedAt).toEqual(live.setupConfirmedAt);
    expect(closed.setupConfirmedAt).toEqual(live.setupConfirmedAt);
    expect(prisma.opsRegistrationPlatform.updateMany).toHaveBeenCalledTimes(3);
  });
  it('rejects headcount import until platform closure', async () => {
    const { service, auditWriter } = createService({ status: 'live' });
    await expect(service.importHeadcount('evt_sample', { headcountSource: 'XPERTO', importedHeadcount: 180 }, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(auditWriter.write).not.toHaveBeenCalled();
  });
  it('writes headcount and actor audit in the same transaction', async () => {
    const { service, auditWriter, database } = createService({ status: 'closed' });
    const result = await service.importHeadcount('evt_sample', { headcountSource: 'XPERTO', importedHeadcount: 180 }, actor);
    expect(result.importedHeadcount).toBe(180);
    expect(auditWriter.write).toHaveBeenCalledWith(expect.objectContaining({ actorRole: OpsUserRole.PmcmAdmin }), expect.objectContaining({ prisma: database }));
  });
  it('rejects invalid lifecycle jumps without writes', async () => {
    const { service, prisma } = createService();
    await expect(service.update('evt_sample', { status: 'closed' }, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.opsRegistrationPlatform.updateMany).not.toHaveBeenCalled();
  });
  it('requires actual event end before import', async () => {
    const { service, event } = createService({ status: 'closed' });
    event.actualEndedAt = null;
    await expect(service.importHeadcount('evt_sample', { headcountSource: 'XPERTO', importedHeadcount: 180 }, actor)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rechecks actual event end through Lifecycle inside the transaction before import', async () => {
    const { service, event, hooks, auditWriter, prisma } = createService({ status: 'closed' });
    hooks.beforeTransaction = () => { event.actualEndedAt = null; };
    await expect(service.importHeadcount('evt_sample', { headcountSource: 'XPERTO', importedHeadcount: 180 }, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.opsRegistrationPlatform.update).not.toHaveBeenCalled();
    expect(auditWriter.write).not.toHaveBeenCalled();
  });
  it('rejects missing supplier on configuration', async () => {
    const { service } = createService({ supplierId: null });
    await expect(service.upsert('evt_sample', { platformType: 'xperto' }, actor)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('requires a selected supplier assignment', async () => {
    const { service, supplierReferences } = createService();
    supplierReferences.findRegistrationSupplier.mockResolvedValue({ id: 'sup_reg', registrationCategory: true, categoryActive: true, selectedForEvent: false });
    await expect(service.upsert('evt_sample', { platformType: 'xperto', supplierId: 'sup_reg' }, actor)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('requires an active Commercial registration category when linking a supplier', async () => {
    const { service, supplierReferences, prisma } = createService();
    supplierReferences.findRegistrationSupplier.mockResolvedValue({ id: 'sup_new', registrationCategory: true, categoryActive: false, selectedForEvent: true });
    await expect(service.update('evt_sample', { supplierId: 'sup_new' }, actor)).rejects.toThrow('active Digital Registration category');
    expect(prisma.opsRegistrationPlatform.updateMany).not.toHaveBeenCalled();
  });

  it('allows existing registration history to be edited after its supplier category becomes inactive', async () => {
    const { service, supplierReferences } = createService();
    supplierReferences.findRegistrationSupplier.mockResolvedValue({ id: 'sup_reg', registrationCategory: true, categoryActive: false, selectedForEvent: true });
    await expect(service.update('evt_sample', { setupNotes: 'Closeout details' }, actor)).resolves.toMatchObject({ setupNotes: 'Closeout details' });
  });
  it('rechecks supplier selection in the command transaction', async () => {
    const { service, hooks, supplierReferences, prisma } = createService();
    hooks.beforeTransaction = () => { supplierReferences.findRegistrationSupplier.mockResolvedValue({ id: 'sup_reg', registrationCategory: true, categoryActive: true, selectedForEvent: false }); };
    await expect(service.upsert('evt_sample', { platformType: 'xperto', supplierId: 'sup_reg' }, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.opsRegistrationPlatform.create).not.toHaveBeenCalled();
  });
  it('validates partial headcount edits against the current transactional row', async () => {
    const { service, hooks, prisma, auditWriter } = createService();
    hooks.beforeTransaction = () => { prisma.opsRegistrationPlatform.findUnique.mockResolvedValue({ ...( {} as OpsRegistrationPlatform), status: 'configuring', supplierId: 'sup_reg', expectedPaxMin: 100, expectedPaxMax: 120 }); };
    await expect(service.update('evt_sample', { expectedPaxMin: 150 }, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.opsRegistrationPlatform.updateMany).not.toHaveBeenCalled();
    expect(auditWriter.write).not.toHaveBeenCalled();
  });
});