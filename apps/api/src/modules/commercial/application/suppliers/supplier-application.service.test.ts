import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { SupplierApplicationService } from './supplier-application.service';

const pmcmAdminActor = { id: 'admin_1', role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true };
const clientActor = { id: 'client_1', role: OpsUserRole.Client, name: 'Client', explicit: true };

function createAccessPolicy() {
  return {
    requireActorRole: async (actor: { role: string }, roles: string[], resource: string) => {
      if (!roles.includes(actor.role)) {
        throw new ForbiddenException(`${actor.role} cannot access ${resource}`);
      }
    },
  };
}

function createPrisma() {
  const applications: Array<Record<string, unknown>> = [
    {
      id: 'sap_1',
      companyName: 'Northstar',
      contactName: 'Ava',
      email: 'ava@northstar.test',
      normalizedEmail: 'ava@northstar.test',
      phone: '',
      categoryId: null,
      pastEvents: '',
      serviceInclusions: '',
      certifications: '',
      priceRange: '',
      bniMember: false,
      portfolioUrl: '',
      additionalNotes: '',
      status: 'pending',
      declineReason: null,
      reviewedAt: null,
      approvedAt: null,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      category: null,
    },
  ];
  return {
    applications,
    prisma: {
      opsSupplierApplication: {
        findMany: async () => applications,
        findUnique: async ({ where }: { where: { id: string } }) =>
          applications.find((row) => row.id === where.id) ?? null,
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const index = applications.findIndex((row) => row.id === where.id);
          applications[index] = { ...applications[index], ...data };
          return applications[index];
        },
      },
      $transaction: async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => callback({
        opsSupplierApplication: {
          updateMany: async ({ where, data }: { where: { id: string; status: string }; data: Record<string, unknown> }) => {
            const row = applications.find((item) => item.id === where.id && item.status === where.status);
            if (!row) return { count: 0 };
            Object.assign(row, data); return { count: 1 };
          },
          findUnique: async ({ where }: { where: { id: string } }) => applications.find((row) => row.id === where.id) ?? null,
        },
      }),
    },
  };
}

describe('SupplierApplicationService inbox', () => {
  it('rejects a client from listing or reviewing applications', async () => {
    const fake = createPrisma();
    const service = new SupplierApplicationService(fake.prisma as never, createAccessPolicy() as never, { write: async () => ({}) });
    await expect(service.listInbox(clientActor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.reviewApplication('sap_1', { action: 'request_proposal' }, clientActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets PMCM request a proposal from the inbox', async () => {
    const fake = createPrisma();
    const service = new SupplierApplicationService(fake.prisma as never, createAccessPolicy() as never, { write: async () => ({}) });
    const listed = await service.listInbox(pmcmAdminActor);
    expect(listed[0]?.status).toBe('pending');
    const reviewed = await service.reviewApplication(
      'sap_1',
      { action: 'request_proposal' },
      pmcmAdminActor,
    );
    expect(reviewed.status).toBe('proposal_requested');
    expect(reviewed.reviewedAt).toBeTruthy();
  });

  it('returns a redacted public status only when the submitting email matches', async () => {
    const fake = createPrisma();
    const service = new SupplierApplicationService(fake.prisma as never, createAccessPolicy() as never, { write: async () => ({}) });
    await expect(service.getPublicStatus({ applicationId: 'sap_1', email: 'AVA@NORTHSTAR.TEST' })).resolves.toMatchObject({
      id: 'sap_1', companyName: 'Northstar', status: 'pending', submittedAt: '2026-09-01T00:00:00.000Z', reviewedAt: null,
    });
    await expect(service.getPublicStatus({ applicationId: 'sap_1', email: 'other@example.test' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects reviewing an application after a terminal transition', async () => {
    const fake = createPrisma();
    fake.applications[0].status = 'proposal_requested';
    const service = new SupplierApplicationService(fake.prisma as never, createAccessPolicy() as never, { write: async () => ({}) });
    await expect(service.reviewApplication('sap_1', { action: 'decline', declineReason: 'No fit' }, pmcmAdminActor))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
