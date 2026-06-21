import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole, SupplierVerificationStatus } from '../ops.constants';
import { SupplierNetworkWorkflowService } from './supplier-network-workflow.service';
import { WorkflowCommandService } from './workflow-command.service';

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
  const prisma = {
    opsSupplierQuoteRequest: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === request.id ? request : null)),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(request, data)),
    },
  };
  const service = new SupplierNetworkWorkflowService(
    prisma as any,
    {} as any,
    { audit } as any,
    {} as any,
    new WorkflowCommandService(),
    {} as any,
    { recordEventDayLog: eventDayLog } as any,
  );
  return { service, prisma, audit, eventDayLog, request };
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
});
