import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { ProposalCommentsService } from './proposal-comments.service';

const client = { id: 'usr-client', role: OpsUserRole.Client, name: 'Ana Client', email: 'ana@client.test', explicit: true, verified: true };
const pmcm = { id: 'usr-pmcm', role: OpsUserRole.PmcmAdmin, name: 'PMCM', email: 'pmcm@test', explicit: true, verified: true };
const supplier = { id: 'usr-sup', role: OpsUserRole.Supplier, name: 'Supplier', email: 'sup@test', explicit: true, verified: true };

function fixture(options: { issued?: boolean; portal?: string } = {}) {
  const event = { id: 'evt-1', eventName: 'Gala', archived: false, clientPortalStatus: options.portal ?? 'unlocked', inquiry: { email: 'ana@client.test' } };
  const version = { id: 'pv-2', versionNumber: 2, status: 'issued', issuedAt: options.issued === false ? null : new Date('2026-11-01T00:00:00Z') };
  const comments: Array<Record<string, unknown>> = [];
  const withVersion = (row: Record<string, unknown>) => ({ ...row, proposalVersion: { versionNumber: version.versionNumber } });
  const tx = {
    opsEvent: { findUnique: vi.fn(async () => event) },
    opsProposalVersion: { findFirst: vi.fn(async () => version) },
    opsProposalComment: {
      findUnique: vi.fn(async ({ where }: { where: { idempotencyKey: string } }) => {
        const row = comments.find((comment) => comment.idempotencyKey === where.idempotencyKey);
        return row ? withVersion(row) : null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, createdAt: new Date('2026-11-02T00:00:00Z') };
        comments.push(row);
        return withVersion(row);
      }),
      findMany: vi.fn(async () => comments.map(withVersion)),
    },
  };
  const prisma = { ...tx, $transaction: vi.fn(async (fn: (value: typeof tx) => unknown) => fn(tx)) };
  const access = {
    requireActorRole: vi.fn(async (actor: { role: string }, roles: string[]) => {
      if (!roles.includes(actor.role)) throw new ForbiddenException('Forbidden');
    }),
    requireCanReadEvent: vi.fn(async () => undefined),
  };
  const audit = { write: vi.fn(async () => undefined) };
  const outbox = { write: vi.fn(async () => undefined) };
  const service = new ProposalCommentsService(prisma as never, access as never, audit as never, outbox as never);
  return { service, comments, outbox, audit };
}

describe('ProposalCommentsService', () => {
  it('threads client comments and PMCM replies on the issued version and notifies the other side once per comment', async () => {
    const f = fixture();
    const first = await f.service.create('evt-1', { body: '  Can we move the stage left?  ', idempotencyKey: 'c-1' }, client);
    await f.service.create('evt-1', { body: 'Yes, updated in the next version.', idempotencyKey: 'c-2' }, pmcm);
    const retry = await f.service.create('evt-1', { body: 'Can we move the stage left?', idempotencyKey: 'c-1' }, client);

    expect(retry.id).toBe(first.id);
    expect(first).toMatchObject({ body: 'Can we move the stage left?', authorRole: 'client', proposalVersionNumber: 2 });
    await expect(f.service.list('evt-1', client)).resolves.toEqual([
      expect.objectContaining({ authorRole: 'client' }),
      expect.objectContaining({ authorRole: 'pmcm-admin', body: 'Yes, updated in the next version.' }),
    ]);
    expect(f.outbox.write).toHaveBeenCalledTimes(2);
    expect(f.outbox.write).toHaveBeenNthCalledWith(1, expect.objectContaining({ recipient: 'PMCM Admin' }), expect.anything());
    expect(f.outbox.write).toHaveBeenNthCalledWith(2, expect.objectContaining({ recipient: 'Client' }), expect.anything());
  });

  it('refuses suppliers, a reused key with different text, a locked client portal and a missing issued proposal', async () => {
    const f = fixture();
    await expect(f.service.create('evt-1', { body: 'Hi', idempotencyKey: 's-1' }, supplier)).rejects.toThrow(ForbiddenException);
    await expect(f.service.list('evt-1', supplier)).rejects.toThrow(ForbiddenException);
    await f.service.create('evt-1', { body: 'First', idempotencyKey: 'k-1' }, client);
    await expect(f.service.create('evt-1', { body: 'Changed', idempotencyKey: 'k-1' }, client)).rejects.toThrow('reused');
    await expect(fixture({ portal: 'locked' }).service.create('evt-1', { body: 'Hi', idempotencyKey: 'l-1' }, client)).rejects.toThrow(ForbiddenException);
    await expect(fixture({ issued: false }).service.create('evt-1', { body: 'Hi', idempotencyKey: 'n-1' }, pmcm)).rejects.toThrow('No issued proposal');
    expect(f.comments).toHaveLength(1);
  });
});
