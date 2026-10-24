import { createHash } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ConformeSigningService } from './conforme-signing.service';

const documentContent = 'Conforme v1 for client and event';
const templateContent = 'Conforme {{clientName}} {{eventName}}';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const clientActor = { actorId: 'client-user', actorRole: 'client', actorName: 'Client Person', actorEmail: 'client@example.test' };
const pmcmActor = { actorId: 'pmcm-user', actorRole: 'pmcm-admin', actorName: 'PMCM Person', actorEmail: 'pmcm@example.test' };

function createFixture() {
  const inquiry: { id: string; status: string; normalizedEmail: string; email: string; clientName: string; companyName: string; eventName: string; eventDate: Date; conformeSignedAt: Date | null } = {
    id: 'inq_1', status: 'accepted', normalizedEmail: 'client@example.test', email: 'client@example.test',
    clientName: 'Client Person', companyName: '', eventName: 'Launch', eventDate: new Date('2027-03-01T00:00:00Z'),
    conformeSignedAt: null,
  };
  const execution = {
    id: 'cfx_1', inquiryId: inquiry.id, eventId: null, templateVersion: 1,
    templateContent, templateSha256: sha256(templateContent), documentContent,
    documentSha256: sha256(documentContent), status: 'awaiting_client', createdAt: new Date('2026-10-16T00:00:00Z'), completedAt: null,
  };
  const signatures: Array<Record<string, unknown>> = [];
  const event = { id: 'evt_1', inquiryId: inquiry.id, status: 'briefing', archived: false, clientPortalStatus: 'unlocked' };
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: 'locked' }]),
    opsInquiry: {
      findUnique: vi.fn(async () => inquiry),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(inquiry, data)),
    },
    opsConformeExecution: {
      findUnique: vi.fn(async () => ({ ...execution, inquiry, signatures: [...signatures] })),
      findFirst: vi.fn(async () => execution),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(execution, data);
        return { ...execution, inquiry, signatures: [...signatures] };
      }),
    },
    opsConformeSignature: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        signatures.push({ ...data, signedAt: new Date('2026-10-16T01:00:00Z') });
        return signatures[signatures.length - 1];
      }),
      findMany: vi.fn(async () => [...signatures]),
    },
    opsEvent: {
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => event),
      create: vi.fn(async () => event),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(event, data)),
    },
    opsPostEventDocument: { createMany: vi.fn(async () => ({ count: 2 })) },
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx)),
    opsConformeExecution: {
      ...tx.opsConformeExecution,
      findUnique: vi.fn(async () => ({ inquiryId: inquiry.id })),
    },
  };
  const auditWriter = { write: vi.fn(async () => undefined) };
  const notifications = { write: vi.fn(async () => undefined) };
  const inquiriesService = {
    activateAfterConforme: vi.fn(async (_transaction: unknown, inquiryId: string, signedAt: Date) => {
      inquiry.conformeSignedAt = signedAt;
      return { event, inquiry };
    }),
    // Acceptance, not signing, sends the client invitation; signing must never reach this.
    sendClientPortalInvitationAfterCommit: vi.fn(async () => undefined),
  };
  const service = new ConformeSigningService(prisma as never, inquiriesService as never, auditWriter as never, notifications as never);
  return { service, tx, prisma, inquiry, execution, signatures, event, auditWriter, notifications, inquiriesService };
}

describe('ConformeSigningService', () => {
  it('returns the same prepared version on an exact request retry without duplicate audit or notice', async () => {
    const f = createFixture();
    const result = await f.service.createExecution('inq_1', { templateVersion: 1, templateContent }, pmcmActor as never);
    expect(result).toMatchObject({ id: 'cfx_1', templateVersion: 1, documentSha256: sha256(documentContent) });
    expect(f.auditWriter.write).not.toHaveBeenCalled();
    expect(f.notifications.write).not.toHaveBeenCalled();
  });

  it('activates the event only after client and PMCM acknowledgments for the displayed hash/version', async () => {
    const f = createFixture();
    const signed = { executionId: 'cfx_1', templateVersion: 1, documentSha256: sha256(documentContent), consentAccepted: true as const };

    const clientResult = await f.service.signForClient(signed, clientActor as never, { ip: '127.0.0.1', userAgent: 'test' });
    expect(clientResult.status).toBe('awaiting_pmcm');
    expect(f.inquiriesService.activateAfterConforme).not.toHaveBeenCalled();
    expect(f.inquiriesService.sendClientPortalInvitationAfterCommit).not.toHaveBeenCalled();
    expect(f.signatures.map((signature) => signature.actorRole)).toEqual(['client']);
    await expect(f.service.signForClient(signed, clientActor as never, {})).resolves.toMatchObject({ status: 'awaiting_pmcm' });
    expect(f.signatures).toHaveLength(1);

    const pmcmResult = await f.service.signForPmcm('inq_1', signed, pmcmActor as never, { ip: '127.0.0.1', userAgent: 'test' });
    expect(pmcmResult.status).toBe('completed');
    expect(pmcmResult.eventId).toBe('evt_1');
    expect(f.inquiriesService.activateAfterConforme).toHaveBeenCalledOnce();
    expect(f.prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(f.notifications.write).toHaveBeenCalledOnce();
    expect(f.auditWriter.write).toHaveBeenCalledTimes(2);
    expect(pmcmResult.signatures).toHaveLength(2);
    expect(pmcmResult.signatures[0]).not.toHaveProperty('ipHash');
    expect(f.inquiriesService.sendClientPortalInvitationAfterCommit).not.toHaveBeenCalled();
    await expect(f.service.signForPmcm('inq_1', signed, pmcmActor as never, {})).resolves.toMatchObject({ status: 'completed' });
    expect(f.inquiriesService.activateAfterConforme).toHaveBeenCalledOnce();
    expect(f.inquiriesService.sendClientPortalInvitationAfterCommit).not.toHaveBeenCalled();
    expect(f.notifications.write).toHaveBeenCalledOnce();
    expect(f.auditWriter.write).toHaveBeenCalledTimes(2);
  });

  it('rejects a stale displayed document hash without recording a signature', async () => {
    const f = createFixture();
    await expect(f.service.signForClient({ executionId: 'cfx_1', templateVersion: 1, documentSha256: 'f'.repeat(64), consentAccepted: true }, clientActor as never, {})).rejects.toThrow(/version has changed/);
    expect(f.signatures).toHaveLength(0);
  });

  it('rejects client and supplier actors from PMCM countersignature', async () => {
    const f = createFixture();
    await expect(f.service.signForPmcm('inq_1', { executionId: 'cfx_1', templateVersion: 1, documentSha256: sha256(documentContent), consentAccepted: true }, clientActor as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(f.service.signForPmcm('inq_1', { executionId: 'cfx_1', templateVersion: 1, documentSha256: sha256(documentContent), consentAccepted: true }, { ...pmcmActor, actorRole: 'supplier' } as never, {})).rejects.toBeInstanceOf(ForbiddenException);
  });
});
