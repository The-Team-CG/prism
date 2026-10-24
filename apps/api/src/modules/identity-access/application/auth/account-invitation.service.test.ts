import { ConflictException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { AccountInvitationService } from './account-invitation.service';
import type { AccountInvitationDeliveryPort } from '../../contracts/account-invitation.port';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';

const portalUrls = {
  client: 'https://client.example.test',
  supplier: 'https://supplier.example.test',
  event: 'https://event.example.test',
};
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
/** The audit writer is called as write(entry, context); the entries are what the trail records. */
const auditEntries = (writer: { write: { mock: { calls: unknown[][] } } }) => writer.write.mock.calls.map(([entry]) => entry);
const pmcmAdmin: ResolvedEventOpsActor = { id: 'usr_pmcm', name: 'Maxine PMCM', role: 'pmcm-admin', explicit: true, verified: true };

function fixture(existing: Record<string, unknown> | null = null, latestInvitation: Record<string, unknown> | null = null) {
  const created: Array<Record<string, unknown>> = [];
  const invitations: Array<Record<string, unknown>> = [];
  const prisma = {
    $queryRaw: vi.fn(async () => []),
    opsUser: {
      findUnique: vi.fn(async () => existing),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { ...data };
      }),
    },
    opsAccountInvitation: {
      updateMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        invitations.push(data);
        return data;
      }),
      findFirst: vi.fn(async () => latestInvitation),
    },
  };
  const transaction = Object.assign(prisma, {
    $transaction: vi.fn(async (work: (tx: typeof prisma) => Promise<unknown>) => work(prisma)),
  });
  const auditWriter = { write: vi.fn(async () => undefined) };
  const delivery = { deliver: vi.fn<AccountInvitationDeliveryPort['deliver']>().mockResolvedValue(undefined) };
  const service = new AccountInvitationService(transaction as never, auditWriter, delivery, portalUrls);
  return { service, prisma, created, invitations, auditWriter, delivery };
}

const clientInput = {
  email: 'Ana@Example.TEST',
  name: 'Ana Reyes',
  role: 'client' as const,
  organization: 'Ana Events',
  source: 'inquiry_acceptance' as const,
  sourceId: 'inq_1',
  actor: { id: 'usr_pmcm', name: 'Maxine PMCM', role: 'pmcm-admin' },
};

describe('AccountInvitationService.provision', () => {
  it('creates an invited account with no password and emails one activation link on the role portal', async () => {
    const { service, created, invitations, delivery, auditWriter } = fixture();

    const outcome = await service.provision(clientInput);

    expect(outcome).toEqual({ outcome: 'invited', sentAt: expect.any(String), expiresAt: expect.any(String) });
    expect(Date.parse((outcome as { expiresAt: string }).expiresAt) - Date.parse((outcome as { sentAt: string }).sentAt)).toBe(SEVEN_DAYS_MS);
    expect(created).toEqual([expect.objectContaining({ email: 'ana@example.test', password: null, role: 'client', approvalStatus: 'invited', organization: 'Ana Events' })]);

    const { recipient, activationUrl, source } = delivery.deliver.mock.calls[0][0];
    expect(source).toBe('inquiry_acceptance');
    const link = new URL(activationUrl);
    expect(recipient).toBe('ana@example.test');
    expect(`${link.origin}${link.pathname}`).toBe('https://client.example.test/activate');
    const token = link.searchParams.get('token')!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    expect(invitations).toEqual([expect.objectContaining({
      tokenHash: sha256(token),
      source: 'inquiry_acceptance',
      sourceId: 'inq_1',
      createdBy: 'usr_pmcm',
      expiresAt: new Date(Date.parse((outcome as { sentAt: string }).sentAt) + SEVEN_DAYS_MS),
    })]);
    expect(JSON.stringify(invitations)).not.toContain(token);
    expect(auditEntries(auditWriter)).toContainEqual(expect.objectContaining({ action: 'Account invitation sent to ana@example.test', severity: 'info' }));
  });

  it('revokes the open invitation and issues a new one when an invited account is invited again', async () => {
    const existing = { id: 'usr_ana', name: 'Ana Reyes', email: 'ana@example.test', role: 'client', approvalStatus: 'invited', password: null, organization: 'Ana Events' };
    const { service, prisma, created, invitations, delivery } = fixture(existing);

    const outcome = await service.provision(clientInput);

    expect(outcome.outcome).toBe('invited');
    expect(prisma.opsAccountInvitation.updateMany).toHaveBeenCalledWith({
      where: { userId: 'usr_ana', consumedAt: null, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(created).toEqual([]);
    expect(invitations).toEqual([expect.objectContaining({ userId: 'usr_ana' })]);
    expect(delivery.deliver).toHaveBeenCalledTimes(1);
  });

  it('issues nothing for an account that already has a password, and says so in the audit', async () => {
    const existing = { id: 'usr_ana', name: 'Ana Reyes', email: 'ana@example.test', role: 'client', approvalStatus: 'approved', password: 'stored-hash' };
    const { service, prisma, invitations, delivery, auditWriter } = fixture(existing);

    await expect(service.provision(clientInput)).resolves.toEqual({ outcome: 'existing_account' });

    expect(prisma.opsUser.create).not.toHaveBeenCalled();
    expect(prisma.opsAccountInvitation.updateMany).not.toHaveBeenCalled();
    expect(invitations).toEqual([]);
    expect(delivery.deliver).not.toHaveBeenCalled();
    expect(auditEntries(auditWriter)).toContainEqual(expect.objectContaining({ action: expect.stringContaining('skipped'), affectedId: 'usr_ana' }));
  });

  it.each(['pending', 'declined'])('refuses an account whose approval is %s: no link, no new account, audited as a warning', async (approvalStatus) => {
    const existing = { id: 'usr_ana', name: 'Ana Reyes', email: 'ana@example.test', role: 'client', approvalStatus, password: 'stored-hash' };
    const { service, prisma, invitations, delivery, auditWriter } = fixture(existing);

    await expect(service.provision(clientInput)).resolves.toEqual({ outcome: 'account_not_active' });

    expect(prisma.opsUser.create).not.toHaveBeenCalled();
    expect(prisma.opsAccountInvitation.updateMany).not.toHaveBeenCalled();
    expect(invitations).toEqual([]);
    expect(delivery.deliver).not.toHaveBeenCalled();
    expect(auditEntries(auditWriter)).toContainEqual(expect.objectContaining({ severity: 'warning', affectedId: 'usr_ana' }));
  });

  it('refuses an email that belongs to a different role, changes nothing, and audits it as a warning', async () => {
    const existing = { id: 'usr_ana', name: 'Ana Reyes', email: 'ana@example.test', role: 'supplier', approvalStatus: 'approved', password: 'stored-hash' };
    const { service, prisma, invitations, delivery, auditWriter } = fixture(existing);

    await expect(service.provision(clientInput)).resolves.toEqual({ outcome: 'role_conflict' });

    expect(prisma.opsUser.create).not.toHaveBeenCalled();
    expect(invitations).toEqual([]);
    expect(delivery.deliver).not.toHaveBeenCalled();
    expect(auditEntries(auditWriter)).toContainEqual(expect.objectContaining({ severity: 'warning', affectedId: 'usr_ana' }));
  });

  it('reports a delivery failure, keeps the invitation open for a resend, and never logs or audits the link', async () => {
    const { service, invitations, delivery, auditWriter } = fixture();
    delivery.deliver.mockRejectedValueOnce(new Error('provider said no to https://client.example.test/activate?token=secret'));

    const outcome = await service.provision(clientInput);

    expect(outcome).toEqual({ outcome: 'delivery_failed' });
    expect(invitations).toHaveLength(1);
    const activationUrl = delivery.deliver.mock.calls[0][0].activationUrl;
    const token = new URL(activationUrl).searchParams.get('token')!;
    const audited = JSON.stringify(auditWriter.write.mock.calls);
    expect(audited).toContain('was not delivered');
    expect(audited).not.toContain(token);
    expect(audited).not.toContain('provider said no');
  });
});

describe('AccountInvitationService staff invites and resends', () => {
  it('lets only a verified PMCM admin invite staff, and records that admin as the creator', async () => {
    const { service, invitations, created } = fixture();

    await expect(service.inviteStaff({ email: 'coord@pmcm.test', name: 'Coordinator', role: 'coordinator', organization: 'PMCM' }, pmcmAdmin))
      .resolves.toEqual({ outcome: 'invited', sentAt: expect.any(String), expiresAt: expect.any(String) });

    expect(created).toEqual([expect.objectContaining({ role: 'coordinator', approvalStatus: 'invited' })]);
    expect(invitations).toEqual([expect.objectContaining({ source: 'admin', sourceId: null, createdBy: 'usr_pmcm' })]);
  });

  it.each([
    ['a client', { ...pmcmAdmin, role: 'client' }],
    ['a supplier', { ...pmcmAdmin, role: 'supplier' }],
    ['a coordinator', { ...pmcmAdmin, role: 'coordinator' }],
    ['an unverified PMCM admin', { ...pmcmAdmin, verified: false }],
  ])('refuses staff invites and resends from %s before touching accounts', async (_label, actor) => {
    const { service, prisma, delivery } = fixture({ id: 'usr_ana', role: 'client', approvalStatus: 'invited', password: null, email: 'ana@example.test', name: 'Ana', organization: 'Ana Events' }, { source: 'inquiry_acceptance', sourceId: 'inq_1' });

    await expect(service.inviteStaff({ email: 'coord@pmcm.test', name: 'Coordinator', role: 'coordinator', organization: 'PMCM' }, actor as ResolvedEventOpsActor))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.resendInvitation('usr_ana', actor as ResolvedEventOpsActor)).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.opsUser.create).not.toHaveBeenCalled();
    expect(prisma.opsAccountInvitation.updateMany).not.toHaveBeenCalled();
    expect(delivery.deliver).not.toHaveBeenCalled();
  });

  it('resends to an invited account with the source of its latest invitation and replaces the open link', async () => {
    const invited = { id: 'usr_ana', name: 'Ana Reyes', email: 'ana@example.test', role: 'client', organization: 'Ana Events', approvalStatus: 'invited', password: null };
    const { service, prisma, invitations, delivery } = fixture(invited, { source: 'inquiry_acceptance', sourceId: 'inq_1' });

    await expect(service.resendInvitation('usr_ana', pmcmAdmin)).resolves.toEqual({ outcome: 'invited', sentAt: expect.any(String), expiresAt: expect.any(String) });

    expect(prisma.opsAccountInvitation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { revokedAt: expect.any(Date) } }));
    expect(invitations).toEqual([expect.objectContaining({ userId: 'usr_ana', source: 'inquiry_acceptance', sourceId: 'inq_1' })]);
    expect(delivery.deliver).toHaveBeenCalledTimes(1);
  });

  it('refuses a resend to an account that has already been activated', async () => {
    const active = { id: 'usr_ana', name: 'Ana Reyes', email: 'ana@example.test', role: 'client', organization: 'Ana Events', approvalStatus: 'approved', password: 'stored-hash' };
    const { service, delivery } = fixture(active, { source: 'inquiry_acceptance', sourceId: 'inq_1' });

    await expect(service.resendInvitation('usr_ana', pmcmAdmin)).rejects.toBeInstanceOf(ConflictException);
    expect(delivery.deliver).not.toHaveBeenCalled();
  });
});
