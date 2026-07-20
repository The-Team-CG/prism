import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/modules/event-core';
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
      uploadConforme: vi.fn(async () => ({ id: 'doc_sample' })),
    } as any,
    resolveActor: vi.fn((input: any = {}, verifiedActor?: any) =>
      verifiedActor
        ? { role: verifiedActor.actorRole, name: verifiedActor.actorName }
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
    expect(context.requireActorRole).toHaveBeenCalledWith(
      { role: OpsUserRole.Client, name: 'anonymous' },
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'log inquiry on behalf',
    );
    expect(context.inquiriesService.logInquiryOnBehalf).not.toHaveBeenCalled();
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
    const verifiedActor = { actorRole: 'client', actorName: 'A Client' };

    await expect(
      service.uploadConforme('inq_sample', { fileName: 'signed.pdf' }, {}, context as any, verifiedActor as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(context.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(context.requireActorRole).toHaveBeenCalledWith(
      { role: 'client', name: 'A Client' },
      [OpsUserRole.PmcmAdmin],
      'conforme upload',
    );
    expect(context.inquiriesService.uploadConforme).not.toHaveBeenCalled();
  });

  it('allows a verified PmcmAdmin actor to upload conforme documents', async () => {
    const { service, context } = createService();
    const verifiedActor = { actorRole: 'pmcm-admin', actorName: 'Ms. Mys' };

    await expect(
      service.uploadConforme('inq_sample', { fileName: 'signed.pdf' }, {}, context as any, verifiedActor as any),
    ).resolves.toEqual({ id: 'doc_sample' });

    expect(context.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(context.inquiriesService.uploadConforme).toHaveBeenCalledWith(
      'inq_sample',
      { fileName: 'signed.pdf' },
      { role: 'pmcm-admin', name: 'Ms. Mys' },
    );
  });
});