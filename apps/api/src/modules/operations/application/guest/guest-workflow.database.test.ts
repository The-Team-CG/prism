import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService, AuditWriterAdapter, SecurityOperationsService } from '@prism/contexts/platform-ops';
import { WorkflowCommandService } from '@prism/kernel/event-core';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { OperationsEventReferenceService } from '../../../event-lifecycle/application/onboarding/operations-event-reference.service';
import { GuestWorkflowService } from './guest-workflow.service';
import { GuestEventProjectionService } from '../../../read-models/application/services/guest-event-projection.service';

const databaseUrl = process.env.P0_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)('guest feedback PostgreSQL transaction acceptance', () => {
  let prisma: PrismaClient;
  let pool: Pool;
  let service: GuestWorkflowService;
  const id = () => `w23_feedback_${randomUUID()}`;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
  });

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (url.hostname !== '127.0.0.1' || url.port !== '55437' || url.pathname !== '/prism_p0') {
      throw new Error('P0_TEST_DATABASE_URL must target the isolated 127.0.0.1:55437/prism_p0 database');
    }
    pool = new Pool({ connectionString: databaseUrl, ssl: false, max: 3 });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    await prisma.$connect();
    const auditService = new AuditService(prisma as never);
    const auditWriter = new AuditWriterAdapter(auditService, new SecurityOperationsService(prisma as never, auditService));
    service = new GuestWorkflowService(
      prisma as never,
      auditWriter,
      new WorkflowCommandService(new PrismTransactionRunner(prisma as never)),
      { findAssignmentForEventActor: vi.fn(async () => ({ id: 'w23_registration', role: 'Registration Staff', status: 'acknowledged' })) } as never,
      new OperationsEventReferenceService(prisma as never),
      {
        listGuestAccessCandidates: (includeArchived: boolean) => prisma.opsEvent.findMany({
          where: includeArchived ? {} : { archived: false },
          select: { id: true, eventName: true, eventDate: true, updatedAt: true, archived: true },
          orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
        }),
        findGuestEvent: (eventId: string) => new GuestEventProjectionService(prisma as never).findGuestEvent(eventId),
        listCoordinatorWorkspaceEvents: async () => [],
      } as never,
      { isDemoEnabledForEvent: vi.fn(() => true), revokeForRosterEntries: vi.fn(async () => undefined) } as never,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    // Keep event and inquiry parents because the current cross-schema event cascade also deletes audit evidence.
  });

  afterAll(async () => { await prisma?.$disconnect(); await pool?.end(); });

  it('persists anonymous check-ins and commits feedback, moderation, and audit atomically', async () => {
    const inquiryId = id();
    const event = await prisma.opsEvent.create({ data: {
      id: id(), clientName: 'W23 transaction client', eventName: 'W23 transaction event',
      eventDate: new Date('2026-09-07T00:00:00Z'), actualEndedAt: new Date('2026-09-07T12:00:00Z'),
      status: 'archived', archived: true, clientPortalStatus: 'unlocked',
      inquiry: { create: { id: inquiryId, clientName: 'W23 transaction client', email: `${inquiryId}@w23.test`, eventName: 'W23 transaction event', clientType: 'Private', eventDate: new Date('2026-09-07T00:00:00Z') } },
    } });
    const anonymousCheckIn = await prisma.opsGuestCheckIn.create({
      data: { id: id(), eventId: event.id, guestName: null, checkInMode: 'headcount', walkIn: true },
    });
    expect(anonymousCheckIn.guestName).toBeNull();
    const feedback = await service.submitFeedbackByAccessCode(service.guestAccessCode(event), { guestName: 'Guest', rating: 5, privacyConsentAccepted: true });
    const moderated = await service.moderateFeedback(event.id, feedback.id, { action: 'approve' }, { id: 'w23-pmcm', name: 'PMCM', role: 'pmcm-admin' });
    expect(moderated).toMatchObject({ moderationStatus: 'approved', moderatedById: 'w23-pmcm' });
    expect(await prisma.opsAuditLog.count({ where: { eventId: event.id, affectedId: feedback.id } })).toBe(2);
  });

  it('redeems concurrent QR scans once and exposes canonical attendance to existing reads', async () => {
    const inquiryId = id();
    const event = await prisma.opsEvent.create({ data: {
      id: id(), clientName: 'W23 QR client', eventName: 'W23 QR event',
      eventDate: new Date('2026-09-07T00:00:00Z'), actualEndedAt: null,
      status: 'event_day', archived: false, clientPortalStatus: 'unlocked',
      walkInPolicy: 'open', walkInThreshold: 200,
      guestPrivacyClassification: 'public',
      inquiry: { create: { id: inquiryId, clientName: 'W23 QR client', email: `${inquiryId}@w23.test`, eventName: 'W23 QR event', clientType: 'Private', eventDate: new Date('2026-09-07T00:00:00Z') } },
    } });
    await prisma.opsBriefing.create({ data: {
      id: id(), eventId: event.id, venue: 'W23 test venue', guestCount: 200, budgetRange: 'test',
    } });
    const batchId = id();
    await prisma.opsGuestRosterImport.create({ data: {
      id: batchId, eventId: event.id, source: 'csv-import', importedById: 'w23-test', importedBy: 'W23 test', rowCount: 1,
    } });
    const rosterEntryId = id();
    await prisma.opsGuestRosterEntry.create({ data: {
      id: rosterEntryId, eventId: event.id, sourceKey: `w23:${rosterEntryId}`,
      guestName: 'QR Guest', normalizedName: 'qr guest', email: `${rosterEntryId}@w23.test`,
      eligibility: 'eligible', verificationStatus: 'verified', source: 'csv-import', importBatchId: batchId,
    } });
    const token = randomBytes(32).toString('base64url');
    await prisma.opsGuestQrPass.create({ data: {
      id: id(), eventId: event.id, rosterEntryId,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      status: 'active', deliveryStatus: 'queued', issuedById: 'w23-test',
    } });
    const accessCode = service.guestAccessCode(event);

    await expect(Promise.all([
      service.checkInByAccessCode(accessCode, { idempotencyKey: randomUUID(), checkInMode: 'qr_pass', passToken: token, privacyConsentAccepted: true }),
      service.checkInByAccessCode(accessCode, { idempotencyKey: randomUUID(), checkInMode: 'qr_pass', passToken: token, privacyConsentAccepted: true }),
    ])).resolves.toEqual([{ accepted: true }, { accepted: true }]);

    expect(await prisma.opsGuestCheckIn.count({ where: { eventId: event.id, rosterEntryId, status: 'checked_in' } })).toBe(1);
    expect(await prisma.opsGuestCheckIn.findFirst({ where: { eventId: event.id, rosterEntryId, status: 'checked_in' } }))
      .toMatchObject({ guestName: 'QR Guest', checkInMode: 'name_search', walkIn: false, verificationStatus: 'verified' });
    expect(await service.countCheckInsForEvent(event.id)).toBe(1);
    expect(await service.listCheckInsForEvent(event.id)).toEqual([
      expect.objectContaining({ checkInMode: 'name_search', rosterEntryId, guestName: 'QR Guest' }),
    ]);
    expect(await service.searchCoordinatorRoster(event.id, { id: 'w23-registration', name: 'Registration Staff', role: 'coordinator' }))
      .toEqual([expect.objectContaining({ id: rosterEntryId, checkedInAt: expect.any(String), walkIn: false })]);
  });
});
