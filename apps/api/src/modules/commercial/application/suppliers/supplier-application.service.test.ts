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
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = {
            ...data,
            createdAt: new Date('2026-09-22T00:00:00.000Z'),
            reviewedAt: null,
            declineReason: null,
            approvedAt: null,
            category: null,
          };
          applications.push(row);
          return row;
        },
      },
      $transaction: async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => callback({
        opsSupplierApplication: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            const row = {
              ...data,
              createdAt: new Date('2026-09-22T00:00:00.000Z'),
              reviewedAt: null,
              declineReason: null,
              approvedAt: null,
              category: null,
            };
            applications.push(row);
            return row;
          },
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
    const service = new SupplierApplicationService(fake.prisma as never, createAccessPolicy() as never, { write: async () => ({}) }, createNotificationWriter());
    await expect(service.listInbox(clientActor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.reviewApplication('sap_1', { action: 'request_proposal' }, clientActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets PMCM request a proposal from the inbox', async () => {
    const fake = createPrisma();
    const service = new SupplierApplicationService(fake.prisma as never, createAccessPolicy() as never, { write: async () => ({}) }, createNotificationWriter());
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
    const service = new SupplierApplicationService(fake.prisma as never, createAccessPolicy() as never, { write: async () => ({}) }, createNotificationWriter());
    const result = await service.getPublicStatus({ applicationId: 'sap_1', email: 'AVA@NORTHSTAR.TEST' });
    expect(result).toMatchObject({
      id: 'sap_1', companyName: 'Northstar', status: 'pending', submittedAt: '2026-09-01T00:00:00.000Z', reviewedAt: null,
    });
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('contactName');
    await expect(service.getPublicStatus({ applicationId: 'sap_1', email: 'other@example.test' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects reviewing an application after a terminal transition', async () => {
    const fake = createPrisma();
    fake.applications[0].status = 'proposal_requested';
    const service = new SupplierApplicationService(fake.prisma as never, createAccessPolicy() as never, { write: async () => ({}) }, createNotificationWriter());
    await expect(service.reviewApplication('sap_1', { action: 'decline', declineReason: 'No fit' }, pmcmAdminActor))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('queues one confirmation email with the new application transaction', async () => {
    const fake = createPrisma();
    fake.applications.length = 0;
    const notifications: Array<{ input: Record<string, unknown>; context: unknown }> = [];
    const notificationWriter = {
      write: async (input: Record<string, unknown>, context: unknown) => {
        notifications.push({ input, context });
        return {};
      },
    };
    const service = new SupplierApplicationService(
      fake.prisma as never,
      createAccessPolicy() as never,
      { write: async () => ({}) },
      notificationWriter as never,
    );

    const application = await service.createSupplierApplication({
      companyName: 'Northstar Events',
      contactName: 'Ava',
      email: 'ava@northstar.test',
      bniMember: false,
      privacyConsentAccepted: true,
      privacyNoticeVersion: '2026-05-01',
    });

    expect(application.id).toMatch(/^sap_/);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.input).toMatchObject({
      recipient: 'ava@northstar.test',
      channel: 'email',
      idempotencyKey: `supplier-application:${application.id}:submitted:v1`,
    });
    expect(notifications[0]?.input.message).toContain(application.id);
    expect(notifications[0]?.context).toMatchObject({ correlationId: `supplier-application:${application.id}:submitted:v1` });
  });
});

function createNotificationWriter() {
  return {
    write: async () => ({}),
    writeGuestPassDelivery: async () => ({ notificationId: 'not_test', status: 'queued' as const }),
    cancelGuestPassDelivery: async () => undefined,
  };
}
