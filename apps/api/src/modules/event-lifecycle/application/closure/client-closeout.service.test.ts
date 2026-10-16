import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { ClientCloseoutService } from './client-closeout.service';

function setup({ archived = false, consent = false } = {}) {
  const event = { id: 'event-1', archived, actualEndedAt: new Date(), inquiry: { email: 'client@example.test' } };
  const response: any = { id: 'response-1', eventId: 'event-1', rating: 5, feedback: 'Great', testimonial: 'Wonderful event', testimonialConsent: consent, moderationStatus: 'pending', actorId: 'client-1', actorEmail: 'client@example.test', submittedAt: new Date() };
  const prisma: any = {
    opsEvent: { findUnique: vi.fn(async () => event) },
    opsClientCloseoutResponse: {
      findUnique: vi.fn(async () => response),
      update: vi.fn(async ({ data }: any) => Object.assign(response, data)),
    },
    $queryRaw: vi.fn(async () => [{ id: 'event-1' }]),
    $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(prisma)),
  };
  const access = { requireActorRole: vi.fn(async () => undefined), requireCanReadEvent: vi.fn(async () => undefined) };
  const auditWriter = { write: vi.fn(async () => undefined) };
  const service = new ClientCloseoutService(prisma as never, access as never, auditWriter as never);
  const client = { id: 'client-1', role: OpsUserRole.Client, email: 'client@example.test', name: 'Client' } as never;
  const pmcm = { id: 'pmcm-1', role: OpsUserRole.PmcmAdmin, email: 'pmcm@example.test', name: 'PMCM' } as never;
  return { service, prisma, event, response, client, pmcm };
}

describe('ClientCloseoutService', () => {
  it('requires explicit client consent before PMCM can approve a testimonial', async () => {
    const { service, prisma, pmcm } = setup();
    await expect(service.moderateTestimonial('event-1', { action: 'approve', reason: '' }, pmcm)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.opsClientCloseoutResponse.update).not.toHaveBeenCalled();
  });

  it('allows the submitting client to withdraw testimonial consent after archive and blocks later moderation', async () => {
    const { service, prisma, response, client, pmcm } = setup({ archived: true, consent: true });
    const withdrawn = await service.revokeTestimonialConsent('event-1', client);
    expect(withdrawn).toMatchObject({ testimonialConsent: false, moderationStatus: 'withdrawn' });
    expect(response).toMatchObject({ testimonialConsent: false, moderationStatus: 'withdrawn' });
    await expect(service.moderateTestimonial('event-1', { action: 'approve', reason: '' }, pmcm)).rejects.toThrow('Archived testimonials cannot be moderated');
    expect(prisma.opsClientCloseoutResponse.update).toHaveBeenCalledTimes(1);
  });
});
