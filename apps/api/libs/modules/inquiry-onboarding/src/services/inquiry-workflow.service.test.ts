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
    inquiriesService: {} as any,
    resolveActor: vi.fn((input = {}) => ({
      role: input.actorRole,
      name: input.actorName ?? 'anonymous',
    })),
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
});