import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole, SupplierVerificationStatus, WorkflowCommandService } from '@prism/modules/event-core';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { SupplierNetworkWorkflowService } from './supplier-network-workflow.service';

function createService() {
  const request = {
    id: 'qr_sonic',
    eventId: 'evt_sample',
    supplierId: 'sup_sonicline',
    supplierName: 'Sonic Line Events',
    category: 'Technicals',
    eventDayVerificationStatus: SupplierVerificationStatus.SelfReported,
  };
  const audit = vi.fn();
  const eventDayLog = vi.fn();
  const suppliers = {
    listSuppliers: vi.fn(async () => [
      { id: 'sup_sonicline', name: 'Sonic Line Events', email: 'supplier@example.com' },
    ]),
  };
  const eventAccessPolicyService = new EventAccessPolicyService({ audit: vi.fn() } as any);
  const prisma = {
    opsSupplierQuoteRequest: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === request.id ? request : null)),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(request, data)),
    },
  };
  const service = new SupplierNetworkWorkflowService(
    prisma as any,
    suppliers as any,
    {} as any,
    { audit } as any,
    eventAccessPolicyService,
    new WorkflowCommandService(),
    {} as any,
    { recordEventDayLog: eventDayLog } as any,
    {} as any,
  );
  return { service, prisma, audit, eventDayLog, request, suppliers };
}

describe('SupplierNetworkWorkflowService', () => {
  it('verifies supplier event-day status through the supplier workflow command', async () => {
    const { service, prisma, audit, eventDayLog } = createService();

    const updated = await service.verifySupplierEventStatus(
      'evt_sample',
      'qr_sonic',
      { verificationStatus: SupplierVerificationStatus.Verified, verifiedBy: 'Ms. Mys', notes: 'Setup checked.' },
      { name: 'PMCM Admin', role: OpsUserRole.PmcmAdmin, explicit: true },
    );

    expect(updated.eventDayVerificationStatus).toBe(SupplierVerificationStatus.Verified);
    expect(updated.eventDayVerifiedBy).toBe('Ms. Mys');
    expect(prisma.opsSupplierQuoteRequest.findUnique).toHaveBeenCalledWith({ where: { id: 'qr_sonic' } });
    expect(eventDayLog).toHaveBeenCalledWith(
      'evt_sample',
      'supplier_status_verified',
      expect.objectContaining({ name: 'PMCM Admin', role: OpsUserRole.PmcmAdmin }),
      'Marked supplier setup verified: Sonic Line Events',
      'supplier_quote_request',
      'qr_sonic',
      { verificationStatus: SupplierVerificationStatus.Verified, verifiedBy: 'Ms. Mys', notes: 'Setup checked.' },
    );
    expect(audit).toHaveBeenCalledWith(
      'evt_sample',
      'PMCM Admin',
      'Marked supplier setup verified: Sonic Line Events',
      expect.objectContaining({
        actorRole: OpsUserRole.PmcmAdmin,
        affectedId: 'qr_sonic',
        metadata: { verificationStatus: SupplierVerificationStatus.Verified, verifiedBy: 'Ms. Mys', notes: 'Setup checked.' },
      }),
    );
  });

  it('rejects unsupported supplier event-day verification statuses before writing', async () => {
    const { service, prisma } = createService();

    await expect(
      service.verifySupplierEventStatus(
        'evt_sample',
        'qr_sonic',
        { verificationStatus: 'unknown' },
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
});
