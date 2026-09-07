import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
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
  const auditWriter = { write: vi.fn(async () => undefined) };
  return {
    event,
    auditWriter,
    prisma: {
      opsEvent: {
        findUnique: async (): Promise<typeof event | null> => event,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(event, data);
          return event;
        },
      },
      opsDocument: { findFirst: async () => ({ id: 'doc_proposal' }) },
      opsAuditLog: { findFirst: async () => null },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
        opsEvent: {
          updateMany: async ({ data }: { data: Record<string, unknown> }) => { Object.assign(event, data); return { count: 1 }; },
          findUniqueOrThrow: async () => event,
        },
        opsAuditLog: { findFirst: async () => null },
      }),
    },
  };
}

describe('ProposalClientReviewService', () => {
  it('rejects a non-primary client contact', async () => {
    const fake = createPrisma();
    const service = new ProposalClientReviewService(fake.prisma as never, createAccessPolicy() as never, fake.auditWriter as never);
    await expect(service.review('evt_1', { action: 'approve' }, otherClient)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects a PMCM actor from the client review path', async () => {
    const fake = createPrisma();
    const service = new ProposalClientReviewService(fake.prisma as never, createAccessPolicy() as never, fake.auditWriter as never);
    await expect(
      service.review('evt_1', { action: 'approve' }, { ...primary, role: OpsUserRole.PmcmAdmin, email: 'mys@pmcm.test' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets the primary contact approve once', async () => {
    const fake = createPrisma();
    const service = new ProposalClientReviewService(fake.prisma as never, createAccessPolicy() as never, fake.auditWriter as never);
    const reviewed = await service.review('evt_1', { action: 'approve', idempotencyKey: 'k1' }, primary);
    expect(reviewed.proposalClientStatus).toBe('approved');
  });

  it('returns not found for a missing event', async () => {
    const fake = createPrisma();
    fake.prisma.opsEvent.findUnique = async () => null;
    const service = new ProposalClientReviewService(fake.prisma as never, createAccessPolicy() as never, fake.auditWriter as never);
    await expect(service.review('missing', { action: 'approve' }, primary)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects locked, archived, or unissued proposals', async () => {
    const fake = createPrisma();
    fake.event.clientPortalStatus = 'locked';
    const service = new ProposalClientReviewService(fake.prisma as never, createAccessPolicy() as never, fake.auditWriter as never);
    await expect(service.review('evt_1', { action: 'approve' }, primary)).rejects.toBeInstanceOf(BadRequestException);
    fake.event.clientPortalStatus = 'unlocked';
    fake.event.archived = true;
    await expect(service.review('evt_1', { action: 'approve' }, primary)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps the revision reason in the atomic audit record', async () => {
    const fake = createPrisma();
    const service = new ProposalClientReviewService(fake.prisma as never, createAccessPolicy() as never, fake.auditWriter as never);
    await service.review('evt_1', { action: 'request_revision', revisionNote: 'Please clarify the venue option', idempotencyKey: 'k2' }, primary);
    expect(fake.auditWriter.write).toHaveBeenCalledWith(expect.objectContaining({ affectedId: 'k2', metadata: expect.objectContaining({ revisionNote: 'Please clarify the venue option' }) }), expect.anything());
  });

  it('rejects a compare-and-swap loser without writing an audit record', async () => {
    const fake = createPrisma();
    fake.prisma.$transaction = async (callback: (tx: any) => Promise<unknown>) => callback({
      opsAuditLog: { findFirst: async () => null },
      opsEvent: { updateMany: async () => ({ count: 0 }), findUniqueOrThrow: async () => fake.event },
    });
    const service = new ProposalClientReviewService(fake.prisma as never, createAccessPolicy() as never, fake.auditWriter as never);
    await expect(service.review('evt_1', { action: 'approve', idempotencyKey: 'race' }, primary)).rejects.toBeInstanceOf(BadRequestException);
    expect(fake.auditWriter.write).not.toHaveBeenCalled();
  });

  it('rejects an idempotency key reused with a different note or actor', async () => {
    const fake = createPrisma();
    fake.prisma.opsAuditLog.findFirst = async () => ({ metadata: { action: 'request_revision', revisionNote: 'original', actorEmail: primary.email } });
    fake.prisma.$transaction = async (callback: (tx: any) => Promise<unknown>) => callback({
      opsAuditLog: { findFirst: fake.prisma.opsAuditLog.findFirst },
      opsEvent: { findUniqueOrThrow: async () => fake.event },
    });
    const service = new ProposalClientReviewService(fake.prisma as never, createAccessPolicy() as never, fake.auditWriter as never);
    await expect(service.review('evt_1', { action: 'request_revision', revisionNote: 'changed', idempotencyKey: 'same' }, primary)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.review('evt_1', { action: 'request_revision', revisionNote: 'original', idempotencyKey: 'same' }, otherClient)).rejects.toBeInstanceOf(BadRequestException);
  });
});
