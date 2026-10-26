import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { WorkflowCommandService, OpsUserRole } from '@prism/kernel/event-core';
import type { PrismVerifiedEventActor } from '@prism/types';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { ConformeSigningService } from '../../src/modules/event-lifecycle/application/onboarding/conforme-signing.service';
import { InquiriesService } from '../../src/modules/event-lifecycle/application/onboarding/inquiries.service';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const live = Boolean(databaseUrl && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(databaseUrl));
if (databaseUrl && !live) throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');

function verifiedActor(id: string, role: OpsUserRole, name: string, email: string): PrismVerifiedEventActor {
  return {
    id, actorId: id, role, actorRole: role, name, actorName: name, email, actorEmail: email,
    expiresAt: '2099-01-01',
  };
}

describe.skipIf(!live)('conforme dual acknowledgment activation against PostgreSQL', () => {
  it('activates one event only after matching client and PMCM signatures and makes exact retries idempotent', async () => {
    const url = databaseUrl!;
    process.env.P0_TEST_DATABASE_URL = url;
    process.env.DATABASE_URL = url;
    process.env.PRISMA_DATABASE_URL = url;
    process.env.DIRECT_URL = url;
    process.env.DB_SSL = 'false';

    const prisma = new PrismaService();
    const suffix = randomUUID().replaceAll('-', '');
    const inquiryId = `conforme_activation_inquiry_${suffix}`;
    const clientEmail = `${suffix}@example.test`;
    const template = 'Conforme for {{clientName}} of {{companyName}} regarding {{eventName}} on {{eventDate}}.';
    const pmcm = verifiedActor(`pmcm_${suffix}`, OpsUserRole.PmcmAdmin, 'Portal Test PMCM', 'portal-test-pmcm@example.test');
    const client = verifiedActor(`client_${suffix}`, OpsUserRole.Client, 'Portal Test Client', clientEmail);
    const wrongClient = verifiedActor(`wrong_client_${suffix}`, OpsUserRole.Client, 'Wrong Client', `wrong-${suffix}@example.test`);
    const audit = { write: async () => undefined };
    const notifications = { write: async () => undefined };

    try {
      await prisma.opsInquiry.create({ data: {
        id: inquiryId, clientName: 'Portal Test Client', companyName: 'Test Company', email: clientEmail,
        normalizedEmail: clientEmail, eventName: 'Portal Conforme Event', eventDate: new Date('2031-04-18T09:00:00.000Z'),
        eventType: 'Corporate', clientType: 'corporate', status: 'pending',
      } });

      // The client invitation goes out when PMCM accepts the inquiry. The port records each call, so signing below can prove it adds none.
      const provision = vi.fn(async (_input: unknown) => ({ outcome: 'invited' as const, sentAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() }));
      const accountProvisioning = { provision };
      const inquiries = new InquiriesService(prisma, audit, notifications, new WorkflowCommandService(), accountProvisioning);
      const signing = new ConformeSigningService(prisma, inquiries, audit, notifications);
      const acceptor = { id: pmcm.id, name: pmcm.name, role: pmcm.role, email: pmcm.email, explicit: true, verified: true } as ResolvedEventOpsActor;

      await inquiries.updateInquiryStatus(inquiryId, { status: 'accepted' }, acceptor);
      expect(provision).toHaveBeenCalledOnce();
      expect(provision).toHaveBeenCalledWith(expect.objectContaining({ email: clientEmail, role: 'client', source: 'inquiry_acceptance', sourceId: inquiryId, actor: { id: pmcm.id, name: pmcm.name, role: pmcm.role } }));
      const accepted = await prisma.opsInquiry.findUniqueOrThrow({ where: { id: inquiryId } });
      expect(accepted).toMatchObject({ status: 'accepted', portalInvitationStatus: 'sent', conformeSignedAt: null });
      expect(accepted.portalInvitationSentAt).toBeInstanceOf(Date);
      expect(accepted.portalInvitationExpiresAt).toBeInstanceOf(Date);
      await inquiries.updateInquiryStatus(inquiryId, { status: 'accepted' }, acceptor);
      expect(provision).toHaveBeenCalledOnce();
      const prepared = await signing.createExecution(inquiryId, { templateVersion: 1, templateContent: template }, pmcm);
      const signInput = {
        executionId: prepared.id,
        templateVersion: prepared.templateVersion,
        documentSha256: prepared.documentSha256,
        consentAccepted: true as const,
      };

      await expect(signing.signForPmcm(inquiryId, signInput, pmcm, {})).rejects.toThrow('The client must sign before PMCM countersigns');
      await expect(signing.signForClient(signInput, wrongClient, {})).rejects.toThrow('not linked to the verified client account');
      await expect(signing.signForClient({ ...signInput, documentSha256: '0'.repeat(64) }, client, {})).rejects.toThrow('displayed conforme version has changed');
      expect(await prisma.opsEvent.count({ where: { inquiryId } })).toBe(0);

      const afterClient = await signing.signForClient(signInput, client, { ip: '127.0.0.1', userAgent: 'portal-integration-test' });
      expect(afterClient.status).toBe('awaiting_pmcm');
      expect(await prisma.opsEvent.count({ where: { inquiryId } })).toBe(0);
      const stillPending = await prisma.opsInquiry.findUniqueOrThrow({ where: { id: inquiryId } });
      expect(stillPending.conformeSignedAt).toBeNull();
      expect(stillPending.portalActivatedAt).toBeNull();

      const completed = await signing.signForPmcm(inquiryId, signInput, pmcm, {});
      expect(completed.status).toBe('completed');
      expect(completed.signatures.map((signature) => signature.actorRole)).toEqual(expect.arrayContaining(['client', 'pmcm']));
      expect(completed.signatures).toHaveLength(2);
      const event = await prisma.opsEvent.findFirstOrThrow({ where: { inquiryId } });
      expect(event).toMatchObject({ status: 'briefing', clientPortalStatus: 'unlocked', archived: false });
      expect(await prisma.opsEvent.count({ where: { inquiryId } })).toBe(1);
      expect(await prisma.opsPostEventDocument.count({ where: { eventId: event.id } })).toBe(2);

      const inquiry = await prisma.opsInquiry.findUniqueOrThrow({ where: { id: inquiryId } });
      expect(inquiry.conformeSignedAt).toBeInstanceOf(Date);
      expect(inquiry.portalActivatedAt).toBeInstanceOf(Date);
      // Signing leaves the invitation fields as acceptance set them and adds no provisioning call.
      expect(inquiry).toMatchObject({ portalInvitationStatus: 'sent', portalInvitationSentAt: accepted.portalInvitationSentAt, portalInvitationExpiresAt: accepted.portalInvitationExpiresAt });
      expect(provision).toHaveBeenCalledOnce();

      await signing.createExecution(inquiryId, { templateVersion: 1, templateContent: template }, pmcm);
      await signing.signForClient(signInput, client, {});
      await signing.signForPmcm(inquiryId, signInput, pmcm, {});
      expect(await prisma.opsEvent.count({ where: { inquiryId } })).toBe(1);
      expect(await prisma.opsConformeSignature.count({ where: { executionId: prepared.id } })).toBe(2);
      expect(await prisma.opsPostEventDocument.count({ where: { eventId: event.id } })).toBe(2);
    } finally {
      await prisma.opsEvent.deleteMany({ where: { inquiryId } });
      await prisma.opsInquiry.deleteMany({ where: { id: inquiryId } });
      await prisma.$disconnect();
    }
  }, 30000);
});
