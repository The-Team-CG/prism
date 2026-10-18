import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { FloorPlanClientReviewService } from './floorplan-client-review.service';

function setup(email = 'client@example.test') {
  const snapshot = { id: 'plan-1', objects: [{ id: 'stage', x: 10 }] };
  const event = { id: 'event-1', archived: false, clientPortalStatus: 'unlocked', inquiry: { email: 'client@example.test' } };
  const draft = { id: 'draft-1', eventId: 'event-1', name: 'Main layout', status: 'in_review', submittedSnapshot: snapshot, approvedSnapshot: null };
  const prisma: any = {
    opsEvent: { findUnique: vi.fn(async () => event) },
    opsFloorPlanDraft: { findFirst: vi.fn(async () => draft) },
    opsFloorPlanClientDecision: { findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => null), create: vi.fn() },
    opsFloorPlanClientAnnotation: { create: vi.fn() },
    $queryRaw: vi.fn(async () => [{ id: event.id }]),
    $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(prisma)),
  };
  const access = {
    requireActorRole: vi.fn(async () => undefined),
    requireCanReadEvent: vi.fn(async () => undefined),
  };
  const auditWriter = { write: vi.fn(async () => undefined) };
  const notifications = { write: vi.fn(async () => undefined) };
  const lifecycleEventReferences = { findFloorplanEvent: vi.fn(async () => ({
    eventId: event.id, eventName: 'Event', clientName: 'Client', clientPortalStatus: 'unlocked', archived: false,
    freezeStatus: 'active', floorPlanStatus: 'ready', readiness: 'ready', primaryClientEmail: 'client@example.test', conformeSigned: true, ocularVisitStatus: 'complete',
  })) };
  const service = new FloorPlanClientReviewService(prisma as never, access as never, auditWriter as never, notifications as never, lifecycleEventReferences as never);
  const actor = { id: 'client-1', role: OpsUserRole.Client, email, name: 'Client' } as never;
  return { service, prisma, actor };
}

describe('FloorPlanClientReviewService', () => {
  it('rejects a decision against an older snapshot before recording or notifying', async () => {
    const { service, prisma, actor } = setup();
    await expect(service.decide('event-1', 'draft-1', {
      snapshotHash: 'a'.repeat(64), action: 'approve', comment: '', idempotencyKey: 'decision-old-snapshot',
    }, actor)).rejects.toThrow('The floorplan changed after this review was opened; reload the latest snapshot');
    expect(prisma.opsFloorPlanClientDecision.create).not.toHaveBeenCalled();
  });

  it('refuses floorplan decisions from a non-primary client contact', async () => {
    const { service, prisma, actor } = setup('other@example.test');
    await expect(service.decide('event-1', 'draft-1', {
      snapshotHash: 'a'.repeat(64), action: 'approve', comment: '', idempotencyKey: 'wrong-client',
    }, actor)).rejects.toThrow('Only the primary client contact can review the official floorplan');
    expect(prisma.opsFloorPlanClientDecision.create).not.toHaveBeenCalled();
  });
});
