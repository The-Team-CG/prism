import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { SupplierApplicationService } from './supplier-application.service';

const accountProvisioning = { provision: async () => ({ outcome: 'invited' as const, sentAt: '2026-10-25T00:00:00.000Z', expiresAt: '2026-11-01T00:00:00.000Z' }) };

const portalUrls = {
  client: 'https://client.example.test',
  supplier: 'https://supplier.example.test',
  event: 'https://event.example.test',
};

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
    const service = new SupplierApplicationService(fake.prisma as never, createAccessPolicy() as never, { write: async () => ({}) }, { write: async () => ({}) }, portalUrls, accountProvisioning as never);
    await expect(service.listInbox(clientActor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.reviewApplication('sap_1', { action: 'request_proposal' }, clientActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets PMCM request a proposal from the inbox', async () => {
    const fake = createPrisma();
    const service = new SupplierApplicationService(fake.prisma as never, createAccessPolicy() as never, { write: async () => ({}) }, { write: async () => ({}) }, portalUrls, accountProvisioning as never);
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
    const service = new SupplierApplicationService(fake.prisma as never, createAccessPolicy() as never, { write: async () => ({}) }, { write: async () => ({}) }, portalUrls, accountProvisioning as never);
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
    const service = new SupplierApplicationService(fake.prisma as never, createAccessPolicy() as never, { write: async () => ({}) }, { write: async () => ({}) }, portalUrls, accountProvisioning as never);
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
      portalUrls,
      accountProvisioning as never,
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

describe('SupplierApplicationService approval conversion', () => {
  const supplierActor = { id: 'sup_user_1', role: OpsUserRole.Supplier, name: 'Supplier', explicit: true };

  function createConversionFake(options: { existingSupplierEmail?: string } = {}) {
    const applications: Array<Record<string, any>> = [{
      id: 'sap_1', companyName: 'Northstar', contactName: 'Ava', email: 'Ava@Northstar.test', normalizedEmail: 'ava@northstar.test',
      phone: '+63 900', categoryId: 'cat_prod', category: { id: 'cat_prod', name: 'Production', active: true },
      pastEvents: '', serviceInclusions: 'LED walls', certifications: '', priceRange: '', bniMember: true, portfolioUrl: '',
      additionalNotes: 'Strong references', status: 'pending', declineReason: null, reviewedAt: null, approvedAt: null,
      convertedSupplierId: null, conversionIdempotencyKey: null, conversionPayloadHash: null, createdAt: new Date('2026-09-01T00:00:00.000Z'),
    }];
    const suppliers: Array<Record<string, any>> = options.existingSupplierEmail
      ? [{ id: 'sup_existing', email: options.existingSupplierEmail }]
      : [];
    const audits: Array<Record<string, any>> = [];
    const findApplication = (id: string) => applications.find((row) => row.id === id) ?? null;
    const tx = {
      $queryRaw: async () => [],
      $executeRaw: async () => 0,
      opsSupplierApplication: {
        updateMany: async ({ where, data }: { where: { id: string; status: string }; data: Record<string, unknown> }) => {
          const row = applications.find((item) => item.id === where.id && item.status === where.status);
          if (!row) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
        findUnique: async ({ where }: { where: { id: string } }) => findApplication(where.id),
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(findApplication(where.id)!, data),
      },
      opsSupplier: {
        findFirst: async ({ where }: { where: { email: { equals: string } } }) =>
          suppliers.find((row) => row.email.toLowerCase() === where.email.equals) ?? null,
        findUnique: async ({ where }: { where: { id: string } }) => suppliers.find((row) => row.id === where.id) ?? null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          suppliers.push(data);
          return data;
        },
      },
    };
    const prisma = {
      opsSupplierApplication: { findUnique: async ({ where }: { where: { id: string } }) => findApplication(where.id) },
      $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    };
    const auditWriter = { write: async (input: Record<string, any>) => { audits.push(input); return {}; } };
    const provisioning = { provision: vi.fn(async (_input: unknown) => ({ outcome: 'invited' as const, sentAt: '2026-10-25T00:00:00.000Z', expiresAt: '2026-11-01T00:00:00.000Z' })) };
    const service = new SupplierApplicationService(prisma as never, createAccessPolicy() as never, auditWriter as never, { write: async () => ({}) } as never, portalUrls, provisioning as never);
    return { service, applications, suppliers, audits, provisioning };
  }

  it('converts an approved application into one pending directory supplier with an audit trail', async () => {
    const fake = createConversionFake();
    const approved = await fake.service.reviewApplication('sap_1', { action: 'approve', idempotencyKey: 'approve-1' }, pmcmAdminActor);

    expect(approved.status).toBe('approved');
    expect(fake.suppliers).toEqual([expect.objectContaining({
      id: 'sup_application_sap_1', categoryId: 'cat_prod', name: 'Northstar', email: 'ava@northstar.test', tier: 'pending_first_event', bniMember: true,
    })]);
    expect(fake.applications[0]).toMatchObject({ convertedSupplierId: 'sup_application_sap_1', conversionIdempotencyKey: 'approve-1' });
    expect(fake.audits.filter((audit) => audit.affectedType === 'supplier')).toEqual([expect.objectContaining({
      affectedId: 'sup_application_sap_1', actionType: 'create', category: 'suppliers',
    })]);
  });

  it('replays the same approval without a second supplier or conversion audit', async () => {
    const fake = createConversionFake();
    await fake.service.reviewApplication('sap_1', { action: 'approve', idempotencyKey: 'approve-1' }, pmcmAdminActor);
    const replayed = await fake.service.reviewApplication('sap_1', { action: 'approve', idempotencyKey: 'approve-1' }, pmcmAdminActor);

    expect(replayed.status).toBe('approved');
    expect(fake.suppliers).toHaveLength(1);
    expect(fake.audits.filter((audit) => audit.affectedType === 'supplier')).toHaveLength(1);
  });

  it('provisions the supplier login from the contact once the approval commits, and not again on replay', async () => {
    const fake = createConversionFake();
    await fake.service.reviewApplication('sap_1', { action: 'approve', idempotencyKey: 'approve-1' }, pmcmAdminActor);
    await fake.service.reviewApplication('sap_1', { action: 'approve', idempotencyKey: 'approve-1' }, pmcmAdminActor);

    expect(fake.provisioning.provision).toHaveBeenCalledTimes(1);
    expect(fake.provisioning.provision).toHaveBeenCalledWith(expect.objectContaining({
      email: 'Ava@Northstar.test', name: 'Ava', role: 'supplier', organization: 'Northstar', source: 'supplier_application', sourceId: 'sap_1',
      actor: { id: 'admin_1', name: 'PMCM Admin', role: 'pmcm-admin' },
    }));
  });

  it('audits a failed supplier login without undoing the approval', async () => {
    const fake = createConversionFake();
    fake.provisioning.provision.mockRejectedValueOnce(new Error('database unavailable'));

    const approved = await fake.service.reviewApplication('sap_1', { action: 'approve', idempotencyKey: 'approve-1' }, pmcmAdminActor);

    expect(approved.status).toBe('approved');
    expect(fake.audits).toContainEqual(expect.objectContaining({ action: 'Supplier login was not created for approved application: Northstar', severity: 'warning' }));
  });

  it.each([
    ['PMCM admin', pmcmAdminActor],
    ['the system', { id: 'system_1', role: OpsUserRole.System, name: 'System', explicit: true }],
  ])('lets %s re-send an approved application supplier login, attributed to that actor', async (_label, actor) => {
    const fake = createConversionFake();
    fake.applications[0]!.status = 'approved';

    await expect(fake.service.resendAccountInvitation('sap_1', actor)).resolves.toEqual({ outcome: 'invited', sentAt: expect.any(String), expiresAt: expect.any(String) });

    expect(fake.provisioning.provision).toHaveBeenCalledWith(expect.objectContaining({
      email: 'Ava@Northstar.test', role: 'supplier', source: 'supplier_application', sourceId: 'sap_1',
      actor: { id: actor.id, name: actor.name, role: actor.role },
    }));
  });

  it('refuses a supplier login re-send from a client or a supplier, before anything is sent', async () => {
    const fake = createConversionFake();
    fake.applications[0]!.status = 'approved';

    await expect(fake.service.resendAccountInvitation('sap_1', clientActor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(fake.service.resendAccountInvitation('sap_1', supplierActor)).rejects.toBeInstanceOf(ForbiddenException);

    expect(fake.provisioning.provision).not.toHaveBeenCalled();
  });

  it.each(['pending', 'declined'])('refuses a supplier login re-send for an application that is %s', async (status) => {
    const fake = createConversionFake();
    fake.applications[0]!.status = status;

    await expect(fake.service.resendAccountInvitation('sap_1', pmcmAdminActor)).rejects.toBeInstanceOf(ConflictException);

    expect(fake.provisioning.provision).not.toHaveBeenCalled();
  });

  it('rejects a replayed approval whose payload differs from the original conversion', async () => {
    const fake = createConversionFake();
    await fake.service.reviewApplication('sap_1', { action: 'approve', idempotencyKey: 'approve-1' }, pmcmAdminActor);
    await expect(fake.service.reviewApplication('sap_1', { action: 'approve', idempotencyKey: 'approve-1', notes: 'changed' }, pmcmAdminActor))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(fake.suppliers).toHaveLength(1);
  });

  it('refuses to convert when a directory supplier already uses the applicant email', async () => {
    const fake = createConversionFake({ existingSupplierEmail: 'AVA@northstar.test' });
    await expect(fake.service.reviewApplication('sap_1', { action: 'approve' }, pmcmAdminActor))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(fake.suppliers).toHaveLength(1);
    expect(fake.audits.filter((audit) => audit.affectedType === 'supplier')).toHaveLength(0);
  });

  it('keeps supplier-role actors from approving or converting applications', async () => {
    const fake = createConversionFake();
    await expect(fake.service.reviewApplication('sap_1', { action: 'approve' }, supplierActor))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(fake.suppliers).toHaveLength(0);
    expect(fake.applications[0]?.status).toBe('pending');
  });
});
