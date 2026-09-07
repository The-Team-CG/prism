import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole, SupplierVerificationStatus, WorkflowCommandService } from '@prism/kernel/event-core';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { SupplierNetworkWorkflowService } from './supplier-network-workflow.service';

function createService() {
  const request = {
    id: 'qr_sonic',
    eventId: 'evt_sample',
    supplierId: 'sup_sonicline',
    supplierName: 'Sonic Line Events',
    category: 'Technicals',
    eventDayVerificationStatus: SupplierVerificationStatus.SelfReported,
    status: 'pending',
    assignmentStatus: 'pending_confirmation',
  };
  const audit = vi.fn();
  const suppliers = {
    listSuppliers: vi.fn(async () => [
      { id: 'sup_sonicline', name: 'Sonic Line Events', email: 'supplier@example.com' },
    ]),
  };
  const eventAccessPolicyService = new EventAccessPolicyService({ write: vi.fn() } as any);
  const prisma = {
    $queryRaw: vi.fn(async () => []),
    opsSupplierQuoteRequest: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === request.id ? request : null)),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(request, data)),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; status?: string; assignmentStatus?: string | null }; data: Record<string, unknown> }) => {
        if (where.status && request.status !== where.status) return { count: 0 };
        if (Object.prototype.hasOwnProperty.call(where, 'assignmentStatus') && request.assignmentStatus !== where.assignmentStatus) return { count: 0 };
        Object.assign(request, data);
        return { count: 1 };
      }),
    },
  };
  const service = new SupplierNetworkWorkflowService(
    prisma as any,
    suppliers as any,
    {} as any,
    { write: audit } as any,
    eventAccessPolicyService,
    new WorkflowCommandService(),
    {} as any,
    {} as any,
  );
  return { service, prisma, audit, request, suppliers };
}

describe('SupplierNetworkWorkflowService', () => {
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
});
