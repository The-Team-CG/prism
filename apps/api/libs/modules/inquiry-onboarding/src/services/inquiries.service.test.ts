import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { WorkflowCommandService } from '@prism/modules/event-core';
import { InquiriesService } from './inquiries.service';

function inquiry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inq_existing',
    clientName: 'Ana Reyes',
    companyName: 'Ayala Corp',
    email: 'ana@ayala.test',
    normalizedEmail: 'ana@ayala.test',
    eventName: 'Ayala Summit',
    eventType: 'Corporate',
    eventDate: new Date('2026-06-18T00:00:00.000Z'),
    clientType: 'Corporate',
    source: 'Website',
    referralDetails: '',
    loggedByRole: null,
    loggedByName: null,
    duplicateOfInquiryId: null,
    previousDeclinedInquiryId: null,
    previousDeclineReason: null,
    message: 'Planning inquiry',
    privacyConsentAccepted: true,
    privacyNoticeVersion: '2026-05-01',
    marketingConsentAccepted: false,
    status: 'new',
    acceptedAt: null,
    pendingAt: null,
    declinedAt: null,
    declineReason: null,
    conformeSentAt: null,
    conformeSignedAt: null,
    portalActivatedAt: null,
    portalInvitationStatus: 'not_sent',
    portalInvitationSentAt: null,
    portalInvitationOpenedAt: null,
    portalInvitationExpiresAt: null,
    followUpIntervalDays: 3,
    lastConformeReminderAt: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createService(existing = [inquiry()]) {
  const records: any[] = [...existing];
  const notifications: any[] = [];
  const audits: any[] = [];
  const prisma = {
    opsInquiry: {
      findMany: vi.fn(async () => records),
      create: vi.fn(async ({ data }) => {
        const row = { ...inquiry(), ...data, createdAt: new Date('2026-05-02T00:00:00.000Z') };
        records.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }) => records.find((item) => item.id === where.id) ?? null),
      update: vi.fn(async ({ where, data }) => {
        const index = records.findIndex((item) => item.id === where.id);
        records[index] = { ...records[index], ...data };
        return records[index];
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
  };
  const auditService = { audit: vi.fn(async (...entry: unknown[]) => audits.push(entry)) };
  const notificationOutboxService = { queue: vi.fn(async (...entry: unknown[]) => notifications.push(entry)) };
  const service = new InquiriesService(
    prisma as any,
    auditService as any,
    notificationOutboxService as any,
    new WorkflowCommandService(),
  );
  return { service, records, notifications, audits, prisma };
}

describe('InquiriesService', () => {
  it('requires privacy consent for public inquiry creation', async () => {
    const { service } = createService([]);

    await expect(
      service.createInquiry({
        clientName: 'Mia Cruz',
        email: 'mia@example.test',
        eventName: 'Privacy Event',
        eventDate: '2026-07-01',
        clientType: 'Corporate',
        message: 'Planning inquiry',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks non-PMCM actors from logging inquiries on behalf of clients', async () => {
    const { service } = createService([]);

    await expect(
      service.logInquiryOnBehalf(
        {
          clientName: 'Walk In Client',
          email: 'walkin@example.test',
          eventName: 'Walk In Product Launch',
          eventDate: '2026-07-10',
          clientType: 'Corporate',
          message: 'Client gave details at PMCM office',
        },
        { actorRole: 'client', actorName: 'Ana Reyes' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('persists the channel and real actor identity when logging an inquiry on behalf of a client', async () => {
    const { service } = createService([]);

    const created = await service.logInquiryOnBehalf(
      {
        clientName: 'Walk In Client',
        email: 'walkin@example.test',
        eventName: 'Walk In Product Launch',
        eventDate: '2026-07-10',
        clientType: 'Corporate',
        channel: 'Walk-In',
        message: 'Client gave details at PMCM office',
      },
      { actorRole: 'pmcm-admin', actorName: 'Marco' },
    );

    expect((created as any).channel).toBe('Walk-In');
    expect((created as any).source).toBe('Log on Behalf');
    expect((created as any).loggedByName).toBe('Marco');
  });

  it('links duplicate and previous declined inquiries by normalized email', async () => {
    const { service } = createService([
      inquiry({ id: 'inq_same_window', eventDate: new Date('2026-07-01T00:00:00.000Z') }),
      inquiry({
        id: 'inq_declined',
        status: 'declined',
        declineReason: 'Date unavailable',
        declinedAt: new Date('2026-05-01T00:00:00.000Z'),
        eventDate: new Date('2026-04-01T00:00:00.000Z'),
      }),
    ]);

    const created = await service.createInquiry({
      clientName: 'Ana Reyes',
      email: ' ANA@ayala.test ',
      eventName: 'Ayala Summit Follow-up',
      eventDate: '2026-07-08',
      clientType: 'Corporate',
      message: 'Second submission for same planning window',
      privacyConsentAccepted: true,
    });

    expect((created as any).normalizedEmail).toBe('ana@ayala.test');
    expect((created as any).duplicateOfInquiryId).toBe('inq_same_window');
    expect((created as any).previousDeclinedInquiryId).toBe('inq_declined');
  });
});