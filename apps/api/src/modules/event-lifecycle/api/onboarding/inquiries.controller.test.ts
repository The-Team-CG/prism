import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { EventSessionGuard } from '@prism/kernel/event-session';
import { OpsInquiriesController } from './inquiries.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

const verifiedPmcmActor = {
  id: 'user_pmcm',
  actorId: 'user_pmcm',
  role: 'pmcm-admin',
  actorRole: 'pmcm-admin',
  email: 'mys@pmcm.test',
  actorEmail: 'mys@pmcm.test',
  name: 'Ms. Mys',
  actorName: 'Ms. Mys',
  expiresAt: '2026-07-15T00:00:00.000Z',
};

describe('OpsInquiriesController', () => {
  it('keeps the public inquiries route base stable under inquiry-onboarding ownership', () => {
    expect(controllerPath(OpsInquiriesController)).toBe('inquiries');
  });

  it('guards uploadConforme with EventSessionGuard (PA-138)', () => {
    const guards = Reflect.getMetadata('__guards__', OpsInquiriesController.prototype.uploadConforme);
    expect(guards).toContain(EventSessionGuard);
  });

  it('guards logOnBehalf with EventSessionGuard (PA-275)', () => {
    const guards = Reflect.getMetadata('__guards__', OpsInquiriesController.prototype.logOnBehalf);
    expect(guards).toContain(EventSessionGuard);
  });

  it('serves inquiry routes through InquiryWorkflowService with inquiry-owned context', async () => {
    const inquiriesService = {};
    const inquiryWorkflowService = {
      listInquiries: vi.fn(async () => [{ id: 'inq_sample' }]),
      logInquiryOnBehalf: vi.fn(async () => ({ id: 'inq_logged' })),
      createInquiry: vi.fn(async () => ({ id: 'inq_created' })),
      updateInquiryStatus: vi.fn(async () => ({ id: 'inq_sample', status: 'accepted' })),
      sendConformeReminder: vi.fn(async () => ({ id: 'inq_sample', lastConformeReminderAt: 'now' })),
      uploadConforme: vi.fn(async () => ({ id: 'doc_sample' })),
    };
    const eventAccessPolicyService = {
      resolveActor: vi.fn((input) => ({ role: input?.actorRole ?? 'pmcm-admin', name: 'PMCM Admin' })),
      requireActorRole: vi.fn(async () => undefined),
    };
    const controller = new OpsInquiriesController(
      inquiriesService as any,
      inquiryWorkflowService as any,
      eventAccessPolicyService as any,
    );

    await expect(controller.list(verifiedPmcmActor as any)).resolves.toEqual([{ id: 'inq_sample' }]);
    await expect(
      controller.logOnBehalf({ clientName: 'Ana', email: 'ana@example.com' } as any, verifiedPmcmActor as any),
    ).resolves.toEqual({
      id: 'inq_logged',
    });
    await expect(controller.create({ clientName: 'Ana', email: 'ana@example.com' } as any)).resolves.toEqual({
      id: 'inq_created',
    });
    await expect(controller.updateStatus('inq_sample', { status: 'accepted' }, verifiedPmcmActor as any)).resolves.toEqual({
      id: 'inq_sample',
      status: 'accepted',
    });
    await expect(controller.sendConformeReminder('inq_sample', verifiedPmcmActor as any)).resolves.toEqual({
      id: 'inq_sample',
      lastConformeReminderAt: 'now',
    });
    await expect(
      controller.uploadConforme('inq_sample', { fileName: 'signed.pdf' } as any, verifiedPmcmActor as any),
    ).resolves.toEqual({
      id: 'doc_sample',
    });

    expect(inquiryWorkflowService.listInquiries).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ inquiriesService, allowedAdminRoles: ['pmcm-admin', 'system'] }),
      verifiedPmcmActor,
    );
    expect(inquiryWorkflowService.logInquiryOnBehalf).toHaveBeenCalledWith(
      expect.objectContaining({ clientName: 'Ana' }),
      {},
      expect.objectContaining({ inquiriesService }),
      verifiedPmcmActor,
    );
    expect(inquiryWorkflowService.createInquiry).toHaveBeenCalledWith(
      expect.objectContaining({ clientName: 'Ana' }),
      expect.objectContaining({ inquiriesService }),
    );
    expect(inquiryWorkflowService.updateInquiryStatus).toHaveBeenCalledWith(
      'inq_sample',
      { status: 'accepted' },
      expect.objectContaining({ inquiriesService }),
      verifiedPmcmActor,
    );
    expect(inquiryWorkflowService.sendConformeReminder).toHaveBeenCalledWith(
      'inq_sample',
      expect.objectContaining({ inquiriesService }),
      verifiedPmcmActor,
    );
    expect(inquiryWorkflowService.uploadConforme).toHaveBeenCalledWith(
      'inq_sample',
      { fileName: 'signed.pdf' },
      {},
      expect.objectContaining({ inquiriesService }),
      verifiedPmcmActor,
    );
  });
});
