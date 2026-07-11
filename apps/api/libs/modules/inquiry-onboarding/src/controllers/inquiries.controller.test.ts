import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsInquiriesController } from './inquiries.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsInquiriesController', () => {
  it('keeps the public inquiries route base stable under inquiry-onboarding ownership', () => {
    expect(controllerPath(OpsInquiriesController)).toBe('inquiries');
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

    await expect(controller.list({ actorRole: 'pmcm-admin' })).resolves.toEqual([{ id: 'inq_sample' }]);
    await expect(controller.logOnBehalf({ clientName: 'Ana', email: 'ana@example.com' } as any, { actorRole: 'pmcm-admin' })).resolves.toEqual({
      id: 'inq_logged',
    });
    await expect(controller.create({ clientName: 'Ana', email: 'ana@example.com' } as any)).resolves.toEqual({
      id: 'inq_created',
    });
    await expect(controller.updateStatus('inq_sample', { status: 'accepted' })).resolves.toEqual({
      id: 'inq_sample',
      status: 'accepted',
    });
    await expect(controller.sendConformeReminder('inq_sample')).resolves.toEqual({
      id: 'inq_sample',
      lastConformeReminderAt: 'now',
    });
    await expect(
      controller.uploadConforme('inq_sample', { fileName: 'signed.pdf' } as any, { actorRole: 'pmcm-admin' }),
    ).resolves.toEqual({
      id: 'doc_sample',
    });

    expect(inquiryWorkflowService.listInquiries).toHaveBeenCalledWith(
      { actorRole: 'pmcm-admin' },
      expect.objectContaining({ inquiriesService, allowedAdminRoles: ['pmcm-admin', 'system'] }),
    );
    expect(inquiryWorkflowService.logInquiryOnBehalf).toHaveBeenCalledWith(
      expect.objectContaining({ clientName: 'Ana' }),
      { actorRole: 'pmcm-admin' },
      expect.objectContaining({ inquiriesService }),
    );
    expect(inquiryWorkflowService.createInquiry).toHaveBeenCalledWith(
      expect.objectContaining({ clientName: 'Ana' }),
      expect.objectContaining({ inquiriesService }),
    );
    expect(inquiryWorkflowService.updateInquiryStatus).toHaveBeenCalledWith(
      'inq_sample',
      { status: 'accepted' },
      expect.objectContaining({ inquiriesService }),
    );
    expect(inquiryWorkflowService.sendConformeReminder).toHaveBeenCalledWith(
      'inq_sample',
      expect.objectContaining({ inquiriesService }),
    );
    expect(inquiryWorkflowService.uploadConforme).toHaveBeenCalledWith(
      'inq_sample',
      { fileName: 'signed.pdf' },
      { actorRole: 'pmcm-admin' },
      expect.objectContaining({ inquiriesService }),
    );
  });
});
