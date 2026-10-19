import { ConflictException, ForbiddenException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { PrismaService } from '@prism/kernel/database';
import type { CommercialAddendumImpactWriter } from '@prism/contexts/commercial';
import type { NotificationOutboxWriter } from '@prism/contexts/platform-ops';
import { AddendumConformeService } from './addendum-conforme.service';
import { sha256 } from './addendum-conforme-document';

// Fixtures are dated 2026-10-19 (the addendum is issued the day before).
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-19T09:00:00.000Z'));
});

afterEach(() => vi.useRealTimers());

const actor = (role: ResolvedEventOpsActor['role'], id: string, email: string, verified = true): ResolvedEventOpsActor => ({
  id, role, email, name: `${role} ${id}`, explicit: true, verified,
});
const primaryClient = actor(OpsUserRole.Client, 'client-primary', 'client@example.test');
const otherClient = actor(OpsUserRole.Client, 'client-other', 'other@example.test');
const pmcm = actor(OpsUserRole.PmcmAdmin, 'pmcm-1', 'pmcm@example.test');
const otherPmcm = actor(OpsUserRole.PmcmAdmin, 'pmcm-2', 'pmcm2@example.test');
const metadata = { ip: '203.0.113.7', userAgent: 'vitest' };

function harness({ billingSourceId = 'billing_source_1' }: { billingSourceId?: string | null } = {}) {
  const event = { id: 'evt_1', clientName: 'Client Person', eventName: 'Launch', archived: false, clientPortalStatus: 'unlocked', inquiry: { email: 'client@example.test' } };
  const addendum = {
    id: 'addendum_1', eventId: 'evt_1', versionNumber: 2, title: 'Add stage lighting', summary: 'Extra rig', financialDelta: 15000,
    comparison: { contract: [], quotes: [{ key: 'quote_1', before: { id: 'quote_1', amount: 20 }, after: { id: 'quote_1', amount: 35 } }] },
    event,
  };
  const executions: Array<Record<string, any>> = [];
  const signatures: Array<Record<string, any>> = [];
  const view = (execution: Record<string, any>) => ({ ...execution, signatures: signatures.filter((s) => s.executionId === execution.id), event });
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: 'locked' }]),
    opsAddendum: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; eventId: string } }) => {
        if (where.id !== addendum.id || where.eventId !== addendum.eventId) return null;
        const existing = executions.find((e) => e.addendumId === addendum.id);
        return { ...addendum, conformeExecution: existing ? view(existing) : null };
      }),
    },
    opsAddendumConformeExecution: {
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
        executions.push({ ...data, createdAt: new Date(), completedAt: null, billingSourceId: null });
        return view(executions[executions.length - 1]!);
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const found = executions.find((e) => e.id === where.id);
        return found ? view(found) : null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, any> }) => {
        const found = executions.find((e) => e.id === where.id)!;
        Object.assign(found, data);
        return view(found);
      }),
    },
    opsAddendumImpact: {
      findFirst: vi.fn(async ({ where }: { where: { addendumId: string; targetType: string } }) =>
        billingSourceId && where.addendumId === addendum.id && where.targetType === 'billing_source' ? { targetId: billingSourceId } : null),
    },
    opsAddendumConformeSignature: {
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
        signatures.push({ ...data, signedAt: new Date() });
        return signatures[signatures.length - 1];
      }),
    },
  };
  const prisma = { $transaction: async (work: (t: typeof tx) => Promise<unknown>) => work(tx) };
  const commercial: CommercialAddendumImpactWriter = {
    apply: vi.fn(async () => []),
    recordConformeExecution: vi.fn(async () => ({ billingSourceId: 'billing_source_1' })),
  };
  const audit = { write: vi.fn(async () => undefined) } as unknown as AuditWriter;
  const notifications = { write: vi.fn(async () => undefined) } as unknown as NotificationOutboxWriter;
  const service = new AddendumConformeService(
    prisma as unknown as PrismaService, new EventAccessPolicyService(audit), audit, notifications, commercial,
  );
  const signInput = () => ({ executionId: executions[0]!.id as string, versionNumber: 2, documentSha256: executions[0]!.documentSha256 as string, consentAccepted: true as const });
  return { service, commercial, executions, signatures, tx, signInput };
}

describe('AddendumConformeService request', () => {
  it('snapshots the issued addendum into a hashed document and never replaces it on replay', async () => {
    const { service, executions, tx } = harness();

    const first = await service.requestExecution('evt_1', 'addendum_1', pmcm);
    const replay = await service.requestExecution('evt_1', 'addendum_1', pmcm);

    expect(first).toMatchObject({ addendumId: 'addendum_1', versionNumber: 2, status: 'awaiting_client', signatures: [] });
    expect(first.documentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.documentContent).toContain('Version 2');
    expect(first.documentContent).toContain('PHP +15,000');
    // The client-facing text carries contract-level changes only; supplier quote lines never reach the signed document or snapshot.
    expect(first.documentContent).toContain('Contract changes');
    expect(first.documentContent).not.toMatch(/quote|supplier|"amount"/i);
    expect(first.documentSha256).toBe(sha256(first.documentContent));
    expect(executions[0]!.snapshot).toMatchObject({ comparison: { contract: [] } });
    expect(executions[0]!.snapshot).not.toHaveProperty('comparison.quotes');
    expect(replay).toEqual(first);
    expect(tx.opsAddendumConformeExecution.create).toHaveBeenCalledTimes(1);
    expect(executions).toHaveLength(1);
  });

  it.each([OpsUserRole.Client, OpsUserRole.Supplier, OpsUserRole.Coordinator, OpsUserRole.Guest])('rejects %s actors without touching data', async (role) => {
    const { service, tx } = harness();

    await expect(service.requestExecution('evt_1', 'addendum_1', actor(role, 'someone', 'client@example.test'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.opsAddendumConformeExecution.create).not.toHaveBeenCalled();
  });
});

describe('AddendumConformeService signing', () => {
  it('runs client acknowledgment then PMCM countersignature and links the billing trace to the executed version', async () => {
    const { service, commercial, signInput, executions, signatures } = harness();
    await service.requestExecution('evt_1', 'addendum_1', pmcm);

    const acknowledged = await service.acknowledgeAsClient('evt_1', 'addendum_1', signInput(), primaryClient, metadata);
    expect(acknowledged.status).toBe('awaiting_pmcm');
    expect(commercial.recordConformeExecution).not.toHaveBeenCalled();

    const completed = await service.countersignAsPmcm('evt_1', 'addendum_1', signInput(), pmcm, metadata);

    expect(completed).toMatchObject({ status: 'completed', completedAt: '2026-10-19T09:00:00.000Z' });
    expect(completed.signatures.map((signature) => signature.actorRole)).toEqual(['client', 'pmcm']);
    expect(commercial.recordConformeExecution).toHaveBeenCalledWith({
      eventId: 'evt_1', addendumId: 'addendum_1', billingSourceId: 'billing_source_1', versionNumber: 2, executionId: executions[0]!.id,
      documentSha256: executions[0]!.documentSha256, executedAt: '2026-10-19T09:00:00.000Z',
    }, expect.objectContaining({ correlationId: 'addendum_1' }));
    expect(executions[0]!.billingSourceId).toBe('billing_source_1');
    // Identity and request evidence come from the verified actor, never from the request body.
    expect(signatures[0]).toMatchObject({ actorId: 'client-primary', actorRole: 'client', actorEmail: 'client@example.test' });
    expect(signatures[0]!.ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(signatures[0]!.ipHash).not.toContain('203.0.113.7');
  });

  it('leaves the billing trace empty when the addendum has no billing line to point at', async () => {
    const { service, commercial, signInput, executions } = harness({ billingSourceId: null });
    await service.requestExecution('evt_1', 'addendum_1', pmcm);
    await service.acknowledgeAsClient('evt_1', 'addendum_1', signInput(), primaryClient, metadata);

    const completed = await service.countersignAsPmcm('evt_1', 'addendum_1', signInput(), pmcm, metadata);

    expect(completed.status).toBe('completed');
    expect(commercial.recordConformeExecution).not.toHaveBeenCalled();
    expect(executions[0]!.billingSourceId).toBeNull();
  });

  it('keeps PMCM from countersigning before the client has acknowledged', async () => {
    const { service, signInput, signatures } = harness();
    await service.requestExecution('evt_1', 'addendum_1', pmcm);

    await expect(service.countersignAsPmcm('evt_1', 'addendum_1', signInput(), pmcm, metadata)).rejects.toBeInstanceOf(ConflictException);
    expect(signatures).toHaveLength(0);
  });

  it.each([
    ['another client', otherClient],
    ['a supplier', actor(OpsUserRole.Supplier, 'supplier-1', 'client@example.test')],
    ['a coordinator', actor(OpsUserRole.Coordinator, 'coord-1', 'client@example.test')],
    ['a guest', actor(OpsUserRole.Guest, 'guest-1', 'client@example.test')],
    ['PMCM admin', pmcm],
    ['an unverified client', { ...primaryClient, verified: false }],
  ])('rejects acknowledgment by %s', async (_label, who) => {
    const { service, signInput, signatures } = harness();
    await service.requestExecution('evt_1', 'addendum_1', pmcm);

    await expect(service.acknowledgeAsClient('evt_1', 'addendum_1', signInput(), who, metadata)).rejects.toBeInstanceOf(ForbiddenException);
    expect(signatures).toHaveLength(0);
  });

  it.each([
    ['the system actor', actor(OpsUserRole.System, 'system', 'system@example.test')],
    ['the client', primaryClient],
    ['a coordinator', actor(OpsUserRole.Coordinator, 'coord-1', 'coord@example.test')],
  ])('rejects countersignature by %s even after the client acknowledged', async (_label, who) => {
    const { service, signInput, signatures } = harness();
    await service.requestExecution('evt_1', 'addendum_1', pmcm);
    await service.acknowledgeAsClient('evt_1', 'addendum_1', signInput(), primaryClient, metadata);

    await expect(service.countersignAsPmcm('evt_1', 'addendum_1', signInput(), who, metadata)).rejects.toBeInstanceOf(ForbiddenException);
    expect(signatures).toHaveLength(1);
  });

  it('replays signatures idempotently and refuses a different account once a role has signed', async () => {
    const { service, commercial, signInput, signatures } = harness();
    await service.requestExecution('evt_1', 'addendum_1', pmcm);
    await service.acknowledgeAsClient('evt_1', 'addendum_1', signInput(), primaryClient, metadata);
    const replayedClient = await service.acknowledgeAsClient('evt_1', 'addendum_1', signInput(), primaryClient, metadata);
    const completed = await service.countersignAsPmcm('evt_1', 'addendum_1', signInput(), pmcm, metadata);
    const replayedPmcm = await service.countersignAsPmcm('evt_1', 'addendum_1', signInput(), pmcm, metadata);

    expect(replayedClient.status).toBe('awaiting_pmcm');
    expect(replayedPmcm).toEqual(completed);
    expect(signatures).toHaveLength(2);
    expect(commercial.recordConformeExecution).toHaveBeenCalledTimes(1);
    await expect(service.countersignAsPmcm('evt_1', 'addendum_1', signInput(), otherPmcm, metadata)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('never replaces or re-signs a completed version', async () => {
    const { service, signInput, executions, signatures, tx } = harness();
    await service.requestExecution('evt_1', 'addendum_1', pmcm);
    await service.acknowledgeAsClient('evt_1', 'addendum_1', signInput(), primaryClient, metadata);
    const completed = await service.countersignAsPmcm('evt_1', 'addendum_1', signInput(), pmcm, metadata);

    const rerequested = await service.requestExecution('evt_1', 'addendum_1', pmcm);

    expect(rerequested).toEqual(completed);
    expect(tx.opsAddendumConformeExecution.create).toHaveBeenCalledTimes(1);
    expect(executions[0]!.documentSha256).toBe(completed.documentSha256);
    expect(signatures).toHaveLength(2);
  });

  it('rejects signing a document version that is no longer the one displayed', async () => {
    const { service, signInput, signatures } = harness();
    await service.requestExecution('evt_1', 'addendum_1', pmcm);

    await expect(service.acknowledgeAsClient('evt_1', 'addendum_1', { ...signInput(), documentSha256: 'a'.repeat(64) }, primaryClient, metadata)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.acknowledgeAsClient('evt_1', 'addendum_1', { ...signInput(), versionNumber: 1 }, primaryClient, metadata)).rejects.toBeInstanceOf(ConflictException);
    expect(signatures).toHaveLength(0);
  });

  it('does not resolve an execution through another addendum or event route', async () => {
    const { service, signInput } = harness();
    await service.requestExecution('evt_1', 'addendum_1', pmcm);

    await expect(service.acknowledgeAsClient('evt_1', 'addendum_other', signInput(), primaryClient, metadata)).rejects.toThrow('Addendum conforme not found');
    await expect(service.acknowledgeAsClient('evt_other', 'addendum_1', signInput(), primaryClient, metadata)).rejects.toThrow('Addendum conforme not found');
  });
});
