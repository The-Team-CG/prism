import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { RegistrationPlatformService } from './registration-platform.service';

const actor = { role: OpsUserRole.PmcmAdmin, name: 'Maxine', explicit: true };

function createService(existing: Record<string, unknown> | null) {
  const prisma = {
    opsEvent: { findUnique: vi.fn(async () => ({ id: 'evt_sample', status: 'archived', archived: true })) },
    opsRegistrationPlatform: {
      findUnique: vi.fn(async () => existing),
      update: vi.fn(async (_args: { data: Record<string, unknown> }) => ({
        ...existing,
        ..._args.data,
        platformType: existing?.platformType ?? 'xperto',
        id: 'reg_1',
      })),
    },
    opsSupplier: { findUnique: vi.fn(async () => ({ id: 'sup_reg', category: { name: 'Digital Registration', slug: 'digital-registration' } })) },
    opsSupplierQuoteRequest: { findFirst: vi.fn(async () => ({ id: 'assignment_1', status: 'selected' })) },
  };
  const workflowCommandService = {
    execute: vi.fn(async (command: { validateState?: () => Promise<void>; write: () => Promise<unknown>; sideEffects?: (result: unknown) => Promise<void> }) => {
      await command.validateState?.();
      const result = await command.write();
      await command.sideEffects?.(result);
      return result;
    }),
  };
  const auditWriter = { write: vi.fn(async () => undefined) };
  const service = new RegistrationPlatformService(prisma as any, auditWriter as any, workflowCommandService as any);
  return { service, prisma, auditWriter };
}

describe('RegistrationPlatformService', () => {
  it('stamps setupConfirmedAt when status becomes live, not closed', async () => {
    const existing = {
      id: 'reg_1',
      eventId: 'evt_sample',
      platformType: 'xperto',
      status: 'configuring',
      supplierId: 'sup_reg',
      setupConfirmedAt: null,
    };
    const { service, prisma } = createService(existing);

    await service.update('evt_sample', { status: 'live' }, actor as any);

    expect(prisma.opsRegistrationPlatform.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'live',
          setupConfirmedAt: expect.any(Date),
        }),
      }),
    );

    await service.update('evt_sample', { status: 'live' }, actor as any);
    existing.status = 'live';
    await service.update('evt_sample', { status: 'closed' }, actor as any);
    const closedCall = prisma.opsRegistrationPlatform.update.mock.calls[2][0];
    expect(closedCall.data.status).toBe('closed');
    expect(closedCall.data.setupConfirmedAt).toBeUndefined();
  });

  it('rejects headcount import until the platform is closed', async () => {
    const { service } = createService({
      id: 'reg_1',
      eventId: 'evt_sample',
      platformType: 'xperto',
      status: 'live',
    });

    await expect(
      service.importHeadcount('evt_sample', { headcountSource: 'XPERTO', importedHeadcount: 180 }, actor as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records the resolved actor role on audit writes', async () => {
    const { service, auditWriter } = createService({
      id: 'reg_1',
      eventId: 'evt_sample',
      platformType: 'xperto',
      status: 'closed',
    });

    await service.importHeadcount('evt_sample', { headcountSource: 'XPERTO', importedHeadcount: 180 }, actor as any);

    expect(auditWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRole: OpsUserRole.PmcmAdmin,
      }),
      undefined,
    );
  });

  it('rejects invalid lifecycle jumps', async () => {
    const { service, prisma } = createService({ id: 'reg_1', eventId: 'evt_sample', platformType: 'xperto', status: 'configuring' });
    await expect(service.update('evt_sample', { status: 'closed' }, actor as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.opsRegistrationPlatform.update).not.toHaveBeenCalled();
  });

  it('requires an ended event before importing a closed platform headcount', async () => {
    const { service, prisma } = createService({ id: 'reg_1', eventId: 'evt_sample', platformType: 'xperto', status: 'closed' });
    prisma.opsEvent.findUnique.mockResolvedValue({ id: 'evt_sample', status: 'event_day', archived: false });
    await expect(service.importHeadcount('evt_sample', { headcountSource: 'XPERTO', importedHeadcount: 180 }, actor as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a supplier without a selected digital registration assignment', async () => {
    const { service, prisma } = createService(null);
    (prisma.opsSupplier.findUnique as any).mockResolvedValue({ id: 'sup_other', category: { name: 'Catering', slug: 'catering' } });
    await expect(service.upsert('evt_sample', { platformType: 'xperto', supplierId: 'sup_other' }, actor as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});
