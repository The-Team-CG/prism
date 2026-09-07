import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { ProposalClientReviewService } from './proposal-client-review.service';

const primary = { id: 'client_1', role: OpsUserRole.Client, name: 'Ana Reyes', email: 'ana@ayala.test', explicit: true };
const otherClient = { id: 'client_2', role: OpsUserRole.Client, name: 'Other', email: 'other@ayala.test', explicit: true };

function createAccessPolicy() {
  return {
    requireActorRole: async (actor: { role: string }, roles: string[], resource: string) => {
      if (!roles.includes(actor.role)) throw new ForbiddenException(`${actor.role} cannot access ${resource}`);
    },
  };
}

function createPrisma() {
  const event = {
    id: 'evt_1',
    inquiryId: 'inq_1',
    clientName: 'Ayala',
    eventName: 'Forum',
    eventDate: new Date('2026-06-18'),
    status: 'planning',
    clientPortalStatus: 'unlocked',
    readiness: 'ready',
    archived: false,
    floorPlanStatus: 'not_started',
    floorPlanId: null,
    proposalClientStatus: 'pending',
    proposalRevisionCount: 0,
    proposalReviewedAt: null,
    proposalReviewedBy: null,
    floorPlanDrafts: [],
    inquiry: { email: 'ana@ayala.test' },
  };
  return {
    event,
    prisma: {
      opsEvent: {
        findUnique: async (): Promise<typeof event | null> => event,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(event, data);
          return event;
        },
      },
    },
  };
}

describe('ProposalClientReviewService', () => {
  it('rejects a non-primary client contact', async () => {
    const fake = createPrisma();
    const service = new ProposalClientReviewService(fake.prisma as never, createAccessPolicy() as never);
    await expect(service.review('evt_1', { action: 'approve' }, otherClient)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects a PMCM actor from the client review path', async () => {
    const fake = createPrisma();
    const service = new ProposalClientReviewService(fake.prisma as never, createAccessPolicy() as never);
    await expect(
      service.review('evt_1', { action: 'approve' }, { ...primary, role: OpsUserRole.PmcmAdmin, email: 'mys@pmcm.test' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets the primary contact approve once', async () => {
    const fake = createPrisma();
    const service = new ProposalClientReviewService(fake.prisma as never, createAccessPolicy() as never);
    const reviewed = await service.review('evt_1', { action: 'approve' }, primary);
    expect(reviewed.proposalClientStatus).toBe('approved');
  });

  it('returns not found for a missing event', async () => {
    const fake = createPrisma();
    fake.prisma.opsEvent.findUnique = async () => null;
    const service = new ProposalClientReviewService(fake.prisma as never, createAccessPolicy() as never);
    await expect(service.review('missing', { action: 'approve' }, primary)).rejects.toBeInstanceOf(NotFoundException);
  });
});
