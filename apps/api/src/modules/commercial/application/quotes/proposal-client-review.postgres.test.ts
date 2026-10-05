import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { PrismaService } from '@prism/kernel/database';
import { AuditService, AuditWriterAdapter, SecurityOperationsService } from '@prism/contexts/platform-ops';
import { DocumentVaultService } from '@prism/contexts/event-lifecycle';
import { ProposalClientReviewService } from './proposal-client-review.service';
import { OpsUserRole } from '@prism/kernel/event-core';

const url = process.env.P0_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (parsed.hostname !== '127.0.0.1' || parsed.port !== '55437' || parsed.pathname !== '/prism_p0') {
    throw new Error('P0_TEST_DATABASE_URL must target the isolated 127.0.0.1:55437/prism_p0 database');
  }
}
const enabled = Boolean(url);
let ids = { inquiry: '', event: '', document: '', secondDocument: '' };
const actor = { id: 'p0_w02_client', role: OpsUserRole.Client, name: 'P0 Client', email: 'p0-w02@example.test', explicit: true };

describe.skipIf(!enabled)('proposal client review PostgreSQL integrity', () => {
  let prisma: PrismaService;
  let auditService: AuditService;
  let service: ProposalClientReviewService;
  const seedFixture = async () => {
    const prefix = `p0_w02_${randomUUID()}`;
    ids = {
      inquiry: `${prefix}_inquiry`,
      event: `${prefix}_event`,
      document: `${prefix}_proposal`,
      secondDocument: `${prefix}_proposal_v2`,
    };
    await prisma.opsInquiry.create({ data: {
      id: ids.inquiry,
      clientName: 'P0 Client',
      email: actor.email,
      normalizedEmail: actor.email,
      eventName: 'P0 W02',
      eventDate: new Date('2030-01-01'),
      clientType: 'Corporate',
      source: 'Other',
      message: 'test',
      privacyConsentAccepted: true,
      privacyNoticeVersion: 'test',
    } });
    await prisma.opsEvent.create({ data: {
      id: ids.event,
      inquiryId: ids.inquiry,
      clientName: 'P0 Client',
      eventName: 'P0 W02',
      eventDate: new Date('2030-01-01'),
      clientPortalStatus: 'unlocked',
      readiness: 'ready',
    } });
    await prisma.opsDocument.create({ data: {
      id: ids.document,
      eventId: ids.event,
      type: 'proposal',
      fileName: 'p0.pdf',
      status: 'issued',
    } });
  };

  beforeAll(async () => {
    for (const variable of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL']) process.env[variable] = url;
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    await prisma.$connect();
    auditService = new AuditService(prisma);
    const writer = new AuditWriterAdapter(auditService, new SecurityOperationsService(prisma, auditService));
    service = new ProposalClientReviewService(prisma, new EventAccessPolicyService(writer), writer, new DocumentVaultService(prisma));
  });

  afterAll(async () => {
    if (!prisma) return;
    // Keep append-only audit rows intact; the disposable database is discarded after this suite.
    await prisma.$disconnect();
  });

  it('persists one revision and one audit across a retry', async () => {
    await seedFixture();
    await service.review(ids.event, { action: 'request_revision', revisionNote: 'Clarify venue', idempotencyKey: 'p0-retry' }, actor);
    await service.review(ids.event, { action: 'request_revision', revisionNote: 'Clarify venue', idempotencyKey: 'p0-retry' }, actor);
    await expect(prisma.opsEvent.findUniqueOrThrow({ where: { id: ids.event } })).resolves.toMatchObject({ proposalRevisionCount: 1 });
    await expect(prisma.opsAuditLog.count({ where: { eventId: ids.event, affectedId: 'p0-retry' } })).resolves.toBe(1);
    await expect(auditService.verifyIntegrity()).resolves.toMatchObject({ valid: true });
  });

  it('requires a newer issued proposal for a second decision', async () => {
    await seedFixture();
    await service.review(ids.event, { action: 'request_revision', revisionNote: 'Need detail', idempotencyKey: 'p0-version-1' }, actor);
    await expect(service.review(ids.event, { action: 'approve', idempotencyKey: 'p0-version-2' }, actor)).rejects.toThrow(/newer issued proposal/i);
    await prisma.opsDocument.create({ data: { id: ids.secondDocument, eventId: ids.event, type: 'proposal', fileName: 'p0-v2.pdf', status: 'issued' } });
    await expect(service.review(ids.event, { action: 'approve', idempotencyKey: 'p0-version-3' }, actor)).resolves.toMatchObject({ proposalClientStatus: 'approved' });
    await expect(service.review(ids.event, { action: 'approve', idempotencyKey: 'p0-version-3' }, actor)).resolves.toMatchObject({ proposalClientStatus: 'approved' });
    await prisma.opsDocument.delete({ where: { id: ids.secondDocument } });
  });

  it('rejects locked, archived, and non-primary clients', async () => {
    await seedFixture();
    await prisma.opsEvent.update({ where: { id: ids.event }, data: { clientPortalStatus: 'locked' } });
    await expect(service.review(ids.event, { action: 'approve', idempotencyKey: 'p0-locked' }, actor)).rejects.toThrow(/locked/i);
    await prisma.opsEvent.update({ where: { id: ids.event }, data: { clientPortalStatus: 'unlocked', archived: true } });
    await expect(service.review(ids.event, { action: 'approve', idempotencyKey: 'p0-archived' }, actor)).rejects.toThrow(/archived/i);
    await prisma.opsEvent.update({ where: { id: ids.event }, data: { archived: false } });
    await expect(service.review(ids.event, { action: 'approve', idempotencyKey: 'p0-wrong-primary' }, { ...actor, email: 'other@example.test' })).rejects.toThrow(/primary client/i);
    await expect(prisma.opsEvent.findUniqueOrThrow({ where: { id: ids.event } })).resolves.toMatchObject({ proposalRevisionCount: 0, proposalClientStatus: 'pending' });
  });

  it('rejects review when no issued proposal document exists', async () => {
    await seedFixture();
    await prisma.opsDocument.update({ where: { id: ids.document }, data: { status: 'draft' } });
    await expect(service.review(ids.event, { action: 'approve', idempotencyKey: 'p0-no-issued' }, actor)).rejects.toThrow(/issued proposal/i);
  });

  it('rejects changed payload reuse and preserves review metadata', async () => {
    await seedFixture();
    await service.review(ids.event, { action: 'request_revision', revisionNote: 'Keep the stage', idempotencyKey: 'p0-payload' }, actor);
    await expect(service.review(ids.event, { action: 'request_revision', revisionNote: 'Change the stage', idempotencyKey: 'p0-payload' }, actor)).rejects.toThrow(/reused/i);
    const audit = await prisma.opsAuditLog.findFirstOrThrow({ where: { eventId: ids.event, affectedId: 'p0-payload' } });
    expect(audit.metadata).toMatchObject({ revisionNote: 'Keep the stage', actorEmail: actor.email, proposalDocumentId: ids.document });
    expect(audit.affectedType).toBe('proposal_client_review');
  });

  it('rolls back the event when durable audit writing fails', async () => {
    await seedFixture();
    const auditService = new AuditService(prisma);
    const realWriter = new AuditWriterAdapter(auditService, new SecurityOperationsService(prisma, auditService));
    const failingWriter = {
      write: async (input: Parameters<typeof realWriter.write>[0], context: Parameters<typeof realWriter.write>[1]) => {
        await realWriter.write(input, context);
        throw new Error('simulated audit failure');
      },
    };
    const failingService = new ProposalClientReviewService(prisma, new EventAccessPolicyService(realWriter), failingWriter, new DocumentVaultService(prisma));
    await expect(failingService.review(ids.event, { action: 'request_revision', revisionNote: 'Must rollback', idempotencyKey: 'p0-audit-failure' }, actor)).rejects.toThrow('simulated audit failure');
    await expect(prisma.opsEvent.findUniqueOrThrow({ where: { id: ids.event } })).resolves.toMatchObject({ proposalRevisionCount: 0, proposalClientStatus: 'pending' });
    await expect(prisma.opsAuditLog.count({ where: { eventId: ids.event, affectedId: 'p0-audit-failure' } })).resolves.toBe(0);
  });

  it('allows only one effect for concurrent same-version decisions', async () => {
    await seedFixture();
    const results = await Promise.allSettled([
      service.review(ids.event, { action: 'request_revision', revisionNote: 'Concurrent A', idempotencyKey: 'p0-concurrent-a' }, actor),
      service.review(ids.event, { action: 'request_revision', revisionNote: 'Concurrent B', idempotencyKey: 'p0-concurrent-b' }, actor),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await expect(prisma.opsEvent.findUniqueOrThrow({ where: { id: ids.event } })).resolves.toMatchObject({ proposalRevisionCount: 1 });
    await expect(prisma.opsAuditLog.count({ where: { eventId: ids.event, affectedType: 'proposal_client_review' } })).resolves.toBe(1);
  });
});
