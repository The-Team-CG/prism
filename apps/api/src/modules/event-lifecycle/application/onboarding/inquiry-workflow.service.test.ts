import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { InquiryWorkflowService } from './inquiry-workflow.service';

function createService() {
  const prisma = {
    opsInquiry: { findMany: vi.fn(async () => []) },
    opsEvent: { findMany: vi.fn(async () => []) },
    opsDocument: { findMany: vi.fn(async () => []) },
  };
  const context = {
    inquiriesService: {
      logInquiryOnBehalf: vi.fn(async () => ({ id: 'inq_logged' })),
      sendConformeReminder: vi.fn(async () => ({ id: 'inq_reminded' })),
      uploadConforme: vi.fn(async () => ({ id: 'doc_sample' })),
    } as any,
    resolveActor: vi.fn((input: any = {}, verifiedActor?: any) =>
      verifiedActor
        ? { id: verifiedActor.actorId, role: verifiedActor.actorRole, name: verifiedActor.actorName, verified: true }
        : { role: input.actorRole, name: input.actorName ?? 'anonymous' },
    ),
    requireActorRole: vi.fn(async (actor, roles, resource) => {
      if (!roles.includes(actor.role)) {
        throw new ForbiddenException(`${actor.role ?? 'anonymous'} cannot access ${resource}`);
      }
    }),
    allowedAdminRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.System],
    mapInquiry: vi.fn((inquiry) => inquiry),
    mapDocument: vi.fn((document) => document),
    mapEvent: vi.fn((event) => event),
  };
  return { service: new InquiryWorkflowService(prisma as any), prisma, context };
}

describe('InquiryWorkflowService', () => {
  it('denies non-PMCM actors before merging inquiries', async () => {
    const { service, context } = createService();
    const mergeInquiry = vi.fn(async () => ({ id: 'merge_1' }));
    (context.inquiriesService as any).mergeInquiry = mergeInquiry;

    await expect(service.mergeInquiry(
      'inq_primary',
      { sourceInquiryId: 'inq_dup', reason: 'Client trying to merge' },
      context as any,
      { actorId: 'client_1', actorRole: OpsUserRole.Client, actorName: 'Ana', verified: true } as any,
    )).rejects.toBeInstanceOf(ForbiddenException);

    expect(mergeInquiry).not.toHaveBeenCalled();
  });

  it('returns the public inquiry receipt through the public mapper only', async () => {
    const { service, context } = createService();
    const publicReceipt = vi.fn(() => ({ id: 'inq_new', status: 'new' }));
    (context as any).mapPublicInquiry = publicReceipt;
    (context.inquiriesService as any).createInquiry = vi.fn(async () => ({ id: 'inq_new', duplicateOfInquiryId: 'inq_x' }));

    await expect(service.createInquiry({} as any, context as any)).resolves.toEqual({ id: 'inq_new', status: 'new' });
    expect(publicReceipt).toHaveBeenCalledWith({ id: 'inq_new', duplicateOfInquiryId: 'inq_x' });
    expect(context.mapInquiry).not.toHaveBeenCalled();
  });

  it('denies anonymous actors from non-public onboarding reads', async () => {
    const { service, prisma, context } = createService();

    await expect(service.listOnboarding({}, context as any)).rejects.toBeInstanceOf(ForbiddenException);

    expect(context.requireActorRole).toHaveBeenCalledWith(
      { role: undefined, name: 'anonymous' },
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'onboarding',
    );
    expect(prisma.opsInquiry.findMany).not.toHaveBeenCalled();
    expect(prisma.opsEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.opsDocument.findMany).not.toHaveBeenCalled();
  });

  it('denies non-PMCM actors before logging inquiries on behalf of clients', async () => {
    const { service, context } = createService();
    const input = {
      clientName: 'Walk In Client',
      email: 'walkin@example.test',
      eventName: 'Walk In Product Launch',
      eventDate: '2026-07-10',
      clientType: 'Corporate',
      message: 'Client gave details at PMCM office',
    };

    await expect(service.logInquiryOnBehalf(input, { actorRole: OpsUserRole.Client }, context as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(context.resolveActor).toHaveBeenCalledWith({ actorRole: OpsUserRole.Client });
    expect(context.requireActorRole).not.toHaveBeenCalled();
    expect(context.inquiriesService.logInquiryOnBehalf).not.toHaveBeenCalled();
  });

  it('denies a verified non-PmcmAdmin/System actor from logging inquiries on behalf', async () => {
    const { service, context } = createService();
    const verifiedActor = { actorId: 'client_1', actorRole: 'client', actorName: 'A Client' };
    const input = {
      clientName: 'Walk In Client',
      email: 'walkin@example.test',
      eventName: 'Walk In Product Launch',
      eventDate: '2026-07-10',
      clientType: 'Corporate',
      message: 'Client gave details at PMCM office',
    };

    await expect(service.logInquiryOnBehalf(input, {}, context as any, verifiedActor as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(context.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(context.requireActorRole).toHaveBeenCalledWith(
      { id: 'client_1', role: 'client', name: 'A Client', verified: true },
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'log inquiry on behalf',
    );
    expect(context.inquiriesService.logInquiryOnBehalf).not.toHaveBeenCalled();
  });

  it('rejects caller-supplied PMCM context before role checks or inquiry creation', async () => {
    const { service, context } = createService();
    const input = {
      clientName: 'Walk In Client',
      email: 'walkin@example.test',
      eventName: 'Walk In Product Launch',
      eventDate: '2026-07-10',
      clientType: 'Corporate',
      message: 'Client gave details at PMCM office',
    };

    await expect(service.logInquiryOnBehalf(
      input,
      { actorId: 'spoofed_admin', actorRole: OpsUserRole.PmcmAdmin, actorName: 'Spoofed Admin' },
      context as any,
    )).rejects.toBeInstanceOf(ForbiddenException);

    expect(context.requireActorRole).not.toHaveBeenCalled();
    expect(context.inquiriesService.logInquiryOnBehalf).not.toHaveBeenCalled();
  });

  it('allows a verified PmcmAdmin actor to log inquiries on behalf', async () => {
    const { service, context } = createService();
    const verifiedActor = { actorId: 'pmcm_1', actorRole: 'pmcm-admin', actorName: 'Ms. Mys' };
    const input = {
      clientName: 'Walk In Client',
      email: 'walkin@example.test',
      eventName: 'Walk In Product Launch',
      eventDate: '2026-07-10',
      clientType: 'Corporate',
      message: 'Client gave details at PMCM office',
    };

    await expect(service.logInquiryOnBehalf(input, {}, context as any, verifiedActor as any)).resolves.toEqual({
      id: 'inq_logged',
    });

    expect(context.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(context.inquiriesService.logInquiryOnBehalf).toHaveBeenCalledWith(input, {
      id: 'pmcm_1',
      role: 'pmcm-admin',
      name: 'Ms. Mys',
      verified: true,
    });
  });

  it('passes the verified actor to the manual conforme reminder command', async () => {
    const { service, context } = createService();
    const verifiedActor = { actorId: 'pmcm_3', actorRole: OpsUserRole.PmcmAdmin, actorName: 'A. Santos' };

    await expect(service.sendConformeReminder('inq_existing', context as any, verifiedActor as any)).resolves.toEqual({
      id: 'inq_reminded',
    });

    expect(context.requireActorRole).toHaveBeenCalledWith(
      { id: 'pmcm_3', role: OpsUserRole.PmcmAdmin, name: 'A. Santos', verified: true },
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'conforme reminder',
    );
    expect(context.inquiriesService.sendConformeReminder).toHaveBeenCalledWith('inq_existing', {
      id: 'pmcm_3', role: OpsUserRole.PmcmAdmin, name: 'A. Santos', verified: true,
    });
  });

  it('denies non-PmcmAdmin actors from uploading conforme documents', async () => {
    const { service, context } = createService();

    await expect(
      service.uploadConforme('inq_sample', { fileName: 'signed.pdf' }, { actorRole: 'client' }, context as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(context.requireActorRole).toHaveBeenCalledWith(
      { role: 'client', name: 'anonymous' },
      [OpsUserRole.PmcmAdmin],
      'conforme upload',
    );
    expect(context.inquiriesService.uploadConforme).not.toHaveBeenCalled();
  });

  it('denies a verified non-PmcmAdmin actor from uploading conforme documents', async () => {
    const { service, context } = createService();
    const verifiedActor = { actorId: 'client_3', actorRole: 'client', actorName: 'A Client' };

    await expect(
      service.uploadConforme('inq_sample', { fileName: 'signed.pdf' }, {}, context as any, verifiedActor as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(context.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(context.requireActorRole).toHaveBeenCalledWith(
      { id: 'client_3', role: 'client', name: 'A Client', verified: true },
      [OpsUserRole.PmcmAdmin],
      'conforme upload',
    );
    expect(context.inquiriesService.uploadConforme).not.toHaveBeenCalled();
  });

  it('allows a verified PmcmAdmin actor to upload conforme documents', async () => {
    const { service, context } = createService();
    const verifiedActor = { actorId: 'pmcm_2', actorRole: 'pmcm-admin', actorName: 'Ms. Mys' };

    await expect(
      service.uploadConforme('inq_sample', { fileName: 'signed.pdf' }, {}, context as any, verifiedActor as any),
    ).resolves.toEqual({ id: 'doc_sample' });

    expect(context.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(context.inquiriesService.uploadConforme).toHaveBeenCalledWith(
      'inq_sample',
      { fileName: 'signed.pdf' },
      { id: 'pmcm_2', role: 'pmcm-admin', name: 'Ms. Mys', verified: true },
    );
  });
});
