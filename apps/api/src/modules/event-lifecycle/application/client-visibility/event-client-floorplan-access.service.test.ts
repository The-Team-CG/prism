import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { EventClientFloorplanAccessService } from './event-client-floorplan-access.service';
import type { PrismApprovedClientAccount } from '@prism/types';

type Service = {
  listAccess(eventId: string, actor: ResolvedEventOpsActor): Promise<unknown>;
  searchCandidates(eventId: string, query: string, actor: ResolvedEventOpsActor): Promise<PrismApprovedClientAccount[]>;
  grant(eventId: string, userId: string, actor: ResolvedEventOpsActor): Promise<unknown>;
  revoke(eventId: string, userId: string, actor: ResolvedEventOpsActor): Promise<unknown>;
  hasActiveGrant(eventId: string, userId: string): Promise<boolean>;
  listActiveSharedEvents(userId: string): Promise<Array<{ eventId: string; eventName: string; eventDate: string }>>;
};
type ServiceConstructor = new (prisma: unknown, policy: unknown, auditWriter: unknown, accountReader: unknown) => Service;
type Grant = {
  id: string;
  eventId: string;
  clientUserId: string;
  active: boolean;
  grantedAt: Date;
  grantedBy: string;
  revokedAt: Date | null;
  revokedBy: string | null;
};

const AccessService = EventClientFloorplanAccessService as unknown as ServiceConstructor;
const event = {
  id: 'evt_floorplan_access',
  eventName: 'Sample Gala',
  eventDate: new Date('2026-11-12T00:00:00.000Z'),
  clientName: 'Primary Client',
  clientPortalStatus: 'unlocked',
  archived: false,
  inquiry: { email: 'primary@example.test' },
};
const admin: ResolvedEventOpsActor = {
  id: 'admin_1', name: 'PMCM Admin', email: 'admin@example.test',
  role: OpsUserRole.PmcmAdmin, explicit: true, verified: true,
};
const client: ResolvedEventOpsActor = {
  id: 'client_1', name: 'Client', email: 'client@example.test',
  role: OpsUserRole.Client, explicit: true, verified: true,
};
const candidate: PrismApprovedClientAccount = {
  id: 'client_secondary', name: 'Secondary Client', email: 'secondary@example.test',
};
const linked: PrismApprovedClientAccount = {
  id: 'client_linked', name: 'Linked Client', email: 'linked@example.test',
};

function createService(options: { accounts?: PrismApprovedClientAccount[]; eventOverride?: Partial<typeof event> } = {}) {
  const accounts = options.accounts ?? [candidate, linked];
  const eventRecord = { ...event, ...options.eventOverride };
  const rows: Grant[] = [{
    id: 'grant_linked', eventId: event.id, clientUserId: linked.id, active: true,
    grantedAt: new Date('2026-10-05T00:00:00.000Z'), grantedBy: 'admin_1',
    revokedAt: null, revokedBy: null,
  }];
  const grantRepository = {
    findUnique: vi.fn(async (args: Record<string, unknown>) => {
      const where = args.where as { eventId_clientUserId?: { eventId: string; clientUserId: string } };
      return rows.find((row) => row.eventId === where.eventId_clientUserId?.eventId && row.clientUserId === where.eventId_clientUserId?.clientUserId) ?? null;
    }),
    findMany: vi.fn(async (args: Record<string, unknown>) => {
      const where = args.where as { eventId?: string; clientUserId?: string; active?: boolean };
      return rows.filter((row) => (!where.eventId || row.eventId === where.eventId)
        && (!where.clientUserId || row.clientUserId === where.clientUserId)
        && (where.active === undefined || row.active === where.active))
        .map((row) => ({ ...row, event: eventRecord }));
    }),
    create: vi.fn(async (args: Record<string, unknown>) => {
      const data = args.data as Omit<Grant, 'id' | 'grantedAt' | 'revokedAt' | 'revokedBy'> & { id: string; grantedAt?: Date };
      const row: Grant = { ...data, grantedAt: data.grantedAt ?? new Date(), revokedAt: null, revokedBy: null };
      rows.push(row);
      return row;
    }),
    update: vi.fn(async (args: Record<string, unknown>) => {
      const where = args.where as { eventId_clientUserId: { eventId: string; clientUserId: string } };
      const row = rows.find((item) => item.eventId === where.eventId_clientUserId.eventId && item.clientUserId === where.eventId_clientUserId.clientUserId);
      if (!row) throw new Error('grant row missing');
      Object.assign(row, args.data);
      return row;
    }),
  };
  const tx = {
    opsEvent: { findUnique: vi.fn(async () => eventRecord) },
    opsEventClientFloorplanAccessGrant: grantRepository,
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const policy = {
    requireActorRole: vi.fn(async (actor: ResolvedEventOpsActor, allowedRoles: string[]) => {
      if (!allowedRoles.includes(actor.role)) throw new ForbiddenException('forbidden');
    }),
  };
  const auditWriter = { write: vi.fn(async () => undefined) };
  const accountReader = {
    searchApprovedClientAccounts: vi.fn(async () => accounts),
    getApprovedClientAccounts: vi.fn(async (userIds: string[]) => accounts.filter((account) => userIds.includes(account.id))),
    isApprovedClientAccount: vi.fn(async (userId: string) => accounts.some((account) => account.id === userId)),
  };
  return {
    service: AccessService ? new AccessService(prisma, policy, auditWriter, accountReader) : undefined,
    prisma,
    policy,
    auditWriter,
    accountReader,
    rows,
    eventRecord,
  };
}

describe('EventClientFloorplanAccessService', () => {
  it('returns approved candidates while excluding the primary contact and active grants', async () => {
    expect(AccessService).toBeDefined();
    if (!AccessService) return;
    const h = createService({ accounts: [
      { id: 'primary_account', name: 'Primary Client', email: 'PRIMARY@example.test' },
      linked,
      candidate,
    ] });
    if (!h.service) return;

    await expect(h.service.searchCandidates(event.id, ' secondary ', admin)).resolves.toEqual([candidate]);
    expect(h.accountReader.searchApprovedClientAccounts).toHaveBeenCalledWith('secondary', admin, 25);
  });

  it('grants only an approved non-primary Client account and audits one state change', async () => {
    expect(AccessService).toBeDefined();
    if (!AccessService) return;
    const h = createService();
    if (!h.service) return;

    await h.service.grant(event.id, candidate.id, admin);
    await h.service.grant(event.id, candidate.id, admin);

    expect(h.rows.filter((row) => row.clientUserId === candidate.id && row.active)).toHaveLength(1);
    expect(h.prisma.opsEventClientFloorplanAccessGrant.create).toHaveBeenCalledTimes(1);
    expect(h.auditWriter.write).toHaveBeenCalledTimes(1);
    expect(h.auditWriter.write).toHaveBeenCalledWith(expect.objectContaining({
      eventId: event.id,
      action: expect.stringContaining('Granted'),
      affectedType: 'client_floorplan_access',
    }), expect.objectContaining({ prisma: expect.any(Object) }));
  });

  it('rejects primary-contact or currently unapproved grant targets', async () => {
    expect(AccessService).toBeDefined();
    if (!AccessService) return;
    const h = createService({ accounts: [
      { id: 'primary_account', name: 'Primary', email: 'PRIMARY@example.test' },
    ] });
    if (!h.service) return;

    await expect(h.service.grant(event.id, 'primary_account', admin)).rejects.toBeInstanceOf(BadRequestException);
    await expect(h.service.grant(event.id, 'not_approved', admin)).rejects.toBeInstanceOf(BadRequestException);
    expect(h.prisma.opsEventClientFloorplanAccessGrant.create).not.toHaveBeenCalled();
  });

  it('revokes, immediately denies reads, and re-grants without retaining stale revocation fields', async () => {
    expect(AccessService).toBeDefined();
    if (!AccessService) return;
    const h = createService();
    if (!h.service) return;

    await h.service.grant(event.id, candidate.id, admin);
    await expect(h.service.hasActiveGrant(event.id, candidate.id)).resolves.toBe(true);
    await h.service.revoke(event.id, candidate.id, admin);
    await h.service.revoke(event.id, candidate.id, admin);
    await expect(h.service.hasActiveGrant(event.id, candidate.id)).resolves.toBe(false);
    await h.service.grant(event.id, candidate.id, admin);
    await expect(h.service.hasActiveGrant(event.id, candidate.id)).resolves.toBe(true);

    const grant = h.rows.find((row) => row.clientUserId === candidate.id);
    expect(grant).toMatchObject({ active: true, revokedAt: null, revokedBy: null, grantedBy: admin.id });
    expect(h.auditWriter.write).toHaveBeenCalledTimes(3);
  });

  it('denies secondary reads for locked events or accounts that are no longer approved Clients', async () => {
    expect(AccessService).toBeDefined();
    if (!AccessService) return;
    const locked = createService({ eventOverride: { clientPortalStatus: 'locked' } });
    if (!locked.service) return;
    const approved = createService();
    if (!approved.service) return;
    approved.accountReader.isApprovedClientAccount.mockResolvedValue(false);

    await expect(locked.service.hasActiveGrant(event.id, linked.id)).resolves.toBe(false);
    await expect(approved.service.hasActiveGrant(event.id, linked.id)).resolves.toBe(false);
    await expect(approved.service.listActiveSharedEvents(linked.id)).resolves.toEqual([]);
  });

  it('requires a PMCM role before reading or changing event grants', async () => {
    expect(AccessService).toBeDefined();
    if (!AccessService) return;
    const h = createService();
    if (!h.service) return;

    await expect(h.service.grant(event.id, candidate.id, client)).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.prisma.opsEventClientFloorplanAccessGrant.create).not.toHaveBeenCalled();
  });
});
