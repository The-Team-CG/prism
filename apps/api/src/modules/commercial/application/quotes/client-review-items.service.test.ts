import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { ClientReviewItemsService } from './client-review-items.service';

function setup() {
  const items: any[] = [];
  const decisions: any[] = [];
  const event = { id: 'event-1', archived: false, clientPortalStatus: 'unlocked', inquiry: { email: 'client@example.test' } };
  const prisma: any = {
    opsEvent: { findUnique: vi.fn(async () => event) },
    opsDocument: { findFirst: vi.fn(async () => null) },
    opsClientReviewItem: {
      findUnique: vi.fn(async ({ where }: any) => items.find((item) => item.idempotencyKey === where.idempotencyKey) ?? null),
      findFirst: vi.fn(async ({ where }: any) => where.id ? items.find((item) => item.id === where.id && item.eventId === where.eventId) ?? null : items.filter((item) => item.eventId === where.eventId && item.kind === where.kind).sort((a, b) => b.version - a.version)[0] ?? null),
      create: vi.fn(async ({ data }: any) => { const item = { ...data, createdAt: new Date() }; items.push(item); return item; }),
    },
    opsClientReviewDecision: {
      findUnique: vi.fn(async ({ where }: any) => decisions.find((item) => item.idempotencyKey === where.idempotencyKey) ?? null),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => { const decision = { ...data, createdAt: new Date() }; decisions.push(decision); return decision; }),
    },
    $queryRaw: vi.fn(async () => [{ id: 'event-1' }]),
    $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(prisma)),
  };
  const access = { requireActorRole: vi.fn(async () => undefined), requireCanReadEvent: vi.fn(async () => undefined) };
  const auditWriter = { write: vi.fn(async () => undefined) };
  const lifecycleEventReferences = {
    findOperationsEvent: vi.fn(async () => ({ id: event.id, archived: event.archived })),
    findEventReadAccess: vi.fn(async () => ({ id: event.id, clientName: 'Client', clientPortalStatus: event.clientPortalStatus, clientEmail: event.inquiry.email, inquiry: event.inquiry })),
  };
  const documentVault = { findEligibleReference: vi.fn(async () => ({ id: 'doc_1', eventId: event.id, kind: 'proposal', status: 'issued', fileName: 'proposal.pdf' })) };
  const service = new ClientReviewItemsService(prisma as never, access as never, auditWriter as never, lifecycleEventReferences as never, documentVault as never);
  const pmcm = { id: 'pmcm-1', role: OpsUserRole.PmcmAdmin, email: 'pmcm@example.test', name: 'PMCM' } as never;
  const client = { id: 'client-1', role: OpsUserRole.Client, email: 'client@example.test', name: 'Client' } as never;
  return { service, prisma, items, decisions, event, pmcm, client };
}

describe('ClientReviewItemsService', () => {
  it('issues immutable increasing versions and replays the same idempotency key without duplication', async () => {
    const { service, items, pmcm } = setup();
    const first = await service.issue('event-1', { kind: 'venue', title: 'Garden', summary: 'Garden venue', idempotencyKey: 'issue-1' }, pmcm);
    const replay = await service.issue('event-1', { kind: 'venue', title: 'Garden', summary: 'Garden venue', idempotencyKey: 'issue-1' }, pmcm);
    const second = await service.issue('event-1', { kind: 'venue', title: 'Hall', summary: 'Indoor venue', idempotencyKey: 'issue-2' }, pmcm);
    expect(first.id).toBe(replay.id);
    expect(second.version).toBe(2);
    expect(items).toHaveLength(2);
  });

  it('rejects a decision against an obsolete version before writing a decision', async () => {
    const { service, prisma, items, pmcm, client } = setup();
    const old = await service.issue('event-1', { kind: 'styling', title: 'Blue', summary: 'Blue palette', idempotencyKey: 'style-1' }, pmcm);
    await service.issue('event-1', { kind: 'styling', title: 'Green', summary: 'Green palette', idempotencyKey: 'style-2' }, pmcm);
    await expect(service.decide('event-1', old.id, { itemVersion: 1, action: 'approve', comment: '', idempotencyKey: 'decision-old' }, client)).rejects.toThrow('A newer option is available; review the latest version');
    expect(prisma.opsClientReviewDecision.create).not.toHaveBeenCalled();
    expect(items).toHaveLength(2);
  });

  it('rejects an idempotency key reused with different proposal content', async () => {
    const { service, pmcm } = setup();
    await service.issue('event-1', { kind: 'venue', title: 'Garden', summary: 'Garden venue', idempotencyKey: 'same-key' }, pmcm);
    await expect(service.issue('event-1', { kind: 'venue', title: 'Hall', summary: 'Hall venue', idempotencyKey: 'same-key' }, pmcm)).rejects.toBeInstanceOf(BadRequestException);
  });
});
