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
  const event = { id: 'evt_sample', status: 'archived', archived: true, actualEndedAt: new Date('2026-09-07T12:00:00Z') as Date | null };
  const hooks = { beforeTransaction: () => {} };
  const database = {
    $queryRaw: vi.fn(async () => [{ id: event.id }]),
    opsEvent: { findUnique: vi.fn(async () => event) },
    opsRegistrationPlatform: {
      findUnique: vi.fn(async () => existing),
      update: vi.fn(async ({ data }: { data: Partial<OpsRegistrationPlatform> }) => (existing = { ...existing, ...data })),
      updateMany: vi.fn(async ({ where, data }: { where: { status: string }; data: Partial<OpsRegistrationPlatform> }) => {
        if (where.status !== existing.status) return { count: 0 };
        existing = { ...existing, ...data };
        return { count: 1 };
      }),
    },
    opsSupplier: { findUnique: vi.fn(async () => ({ id: 'sup_reg', category: { name: 'Digital Registration', slug: 'digital-registration' } })) },
    opsSupplierQuoteRequest: { findFirst: vi.fn(async (): Promise<{ id: string; status: string } | null> => ({ id: 'assignment_1', status: 'selected' })) },
  };
  const prisma = { ...database, $transaction: async <T>(work: (tx: typeof database) => Promise<T>) => { hooks.beforeTransaction(); return work(database); } };
  const auditWriter = { write: vi.fn(async () => undefined) };
  const workflow = new WorkflowCommandService(new PrismTransactionRunner(prisma as unknown as PrismaService));
  const service = new RegistrationPlatformService(prisma as unknown as PrismaService, auditWriter, workflow);
  return { service, prisma, database, auditWriter, hooks, event };
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
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
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
  it('rechecks actual event end inside the transaction before import', async () => {
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
    const { service, prisma } = createService();
    prisma.opsSupplierQuoteRequest.findFirst.mockResolvedValue(null);
    await expect(service.upsert('evt_sample', { platformType: 'xperto', supplierId: 'sup_reg' }, actor)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('validates partial headcount edits against the current transactional row', async () => {
    const { service, hooks, prisma, auditWriter } = createService();
    hooks.beforeTransaction = () => { prisma.opsRegistrationPlatform.findUnique.mockResolvedValue({ ...( {} as OpsRegistrationPlatform), status: 'configuring', supplierId: 'sup_reg', expectedPaxMin: 100, expectedPaxMax: 120 }); };
    await expect(service.update('evt_sample', { expectedPaxMin: 150 }, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.opsRegistrationPlatform.updateMany).not.toHaveBeenCalled();
    expect(auditWriter.write).not.toHaveBeenCalled();
  });
});
