import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { OpsEventBillingController } from './event-billing.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

function createController() {
  const billingOperationsService = {
    createBillingSource: vi.fn(async () => ({ id: 'bsrc_new' })),
    approveBillingSource: vi.fn(async () => ({ id: 'bsrc_new', status: 'approved' })),
    generateBillingStatement: vi.fn(async () => ({ id: 'bill_new' })),
    sendBillingStatement: vi.fn(async () => ({ id: 'bill_new', status: 'sent' })),
  };
  const paymentOperationsService = {
    markPayment: vi.fn(async () => ({ id: 'pay_downpayment', status: 'paid' })),
    recordPayment: vi.fn(async () => ({ id: 'pay_downpayment', amountPaid: 50000 })),
  };
  const billingAdjustmentService = {
    requestBillingCorrection: vi.fn(async () => ({ id: 'corr_new' })),
    resolveBillingCorrection: vi.fn(async () => ({ id: 'corr_new', status: 'approved' })),
    createBillingDispute: vi.fn(async () => ({ id: 'dispute_new' })),
    resolveBillingDispute: vi.fn(async () => ({ id: 'dispute_new', status: 'resolved' })),
    createAdditionalBilling: vi.fn(async () => ({ id: 'addbill_new' })),
    waiveAdditionalBilling: vi.fn(async () => ({ id: 'addbill_new', status: 'waived' })),
  };
  const eventAccessPolicyService = {
    resolveActor: vi.fn((input = {}, verified?: any) => ({
      id: verified?.id ?? verified?.actorId ?? input.actorId ?? input.id,
      role: verified?.actorRole ?? input.actorRole ?? OpsUserRole.PmcmAdmin,
      name: verified?.actorName ?? input.actorName ?? 'PMCM Admin',
      email: verified?.actorEmail ?? input.actorEmail,
    })),
    requireActorRole: vi.fn(async () => undefined),
  };
  const controller = new OpsEventBillingController(
    billingOperationsService as any,
    paymentOperationsService as any,
    billingAdjustmentService as any,
    eventAccessPolicyService as any,
  );
  return { controller, billingOperationsService, paymentOperationsService, billingAdjustmentService, eventAccessPolicyService };
}

describe('OpsEventBillingController', () => {
  it('keeps event billing routes under the events route base', () => {
    expect(controllerPath(OpsEventBillingController)).toBe('events');
  });

  it('routes billing, payment, and adjustment commands through their own operations services', async () => {
    const { controller, billingOperationsService, paymentOperationsService, billingAdjustmentService, eventAccessPolicyService } = createController();
    const actor = {
      id: 'user_maxine', actorId: 'user_maxine', actorRole: OpsUserRole.PmcmAdmin,
      actorName: 'Maxine', actorEmail: 'maxine@pmcm.test', expiresAt: '2026-10-04T12:00:00.000Z', eventId: 'evt_sample',
    };

    await expect(
      controller.createBillingSource(
        'evt_sample',
        { sourceLabel: 'Conforme billing', lineItems: [{ label: 'Package', amount: 100000 }] },
        actor as never,
      ),
    ).resolves.toEqual({ id: 'bsrc_new' });
    await expect(controller.approveBillingSource('evt_sample', 'bsrc_new', { approvalNotes: 'Checked' }, actor as never)).resolves.toEqual({
      id: 'bsrc_new',
      status: 'approved',
    });
    await expect(controller.generateBillingStatement('evt_sample', { sourceId: 'bsrc_new' }, actor as never)).resolves.toEqual({
      id: 'bill_new',
    });
    await expect(controller.markPayment('evt_sample', 'pay_downpayment', { status: 'paid' }, actor as never)).resolves.toEqual({
      id: 'pay_downpayment',
      status: 'paid',
    });
    await expect(
      controller.recordPayment(
        'evt_sample',
        'pay_downpayment',
        { amountReceived: 50000, paymentDate: '2026-06-20', paymentMethod: 'Bank Transfer' },
        actor as never,
      ),
    ).resolves.toEqual({ id: 'pay_downpayment', amountPaid: 50000 });
    await expect(controller.sendBillingStatement('evt_sample', 'bill_new', actor as never)).resolves.toEqual({
      id: 'bill_new',
      status: 'sent',
    });
    await expect(controller.requestBillingCorrection('evt_sample', { statementId: 'bill_new', reason: 'Tax line is incorrect', idempotencyKey: 'corr-controller-1' }, actor as never)).resolves.toEqual({ id: 'corr_new' });
    await expect(controller.resolveBillingCorrection('evt_sample', 'corr_new', { action: 'approve' }, actor as never)).resolves.toEqual({ id: 'corr_new', status: 'approved' });
    await expect(controller.createBillingDispute('evt_sample', { statementId: 'bill_new', amount: 500, reason: 'Duplicate charge', idempotencyKey: 'dispute-controller-1' }, actor as never)).resolves.toEqual({ id: 'dispute_new' });
    await expect(controller.resolveBillingDispute('evt_sample', 'dispute_new', { action: 'resolve', resolutionNotes: 'Reviewed' }, actor as never)).resolves.toEqual({ id: 'dispute_new', status: 'resolved' });
    await expect(controller.createAdditionalBilling('evt_sample', { urgentIssueId: 'issue_new', description: 'Overtime', amount: 500, idempotencyKey: 'additional-controller-1' }, actor as never)).resolves.toEqual({ id: 'addbill_new' });
    await expect(controller.waiveAdditionalBilling('evt_sample', 'addbill_new', { reason: 'Approved goodwill' }, actor as never)).resolves.toEqual({ id: 'addbill_new', status: 'waived' });

    expect(eventAccessPolicyService.requireActorRole).toHaveBeenCalledTimes(12);
    expect(eventAccessPolicyService.requireActorRole).toHaveBeenCalledWith(
      { id: 'user_maxine', role: OpsUserRole.PmcmAdmin, name: 'Maxine', email: 'maxine@pmcm.test' },
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'billing source',
      'evt_sample',
    );
    expect(billingOperationsService.createBillingSource).toHaveBeenCalledWith(
      'evt_sample',
      { sourceLabel: 'Conforme billing', lineItems: [{ label: 'Package', amount: 100000 }] },
      { id: 'user_maxine', name: 'Maxine', role: OpsUserRole.PmcmAdmin, email: 'maxine@pmcm.test' },
    );
    expect(billingOperationsService.generateBillingStatement).toHaveBeenCalledWith(
      'evt_sample',
      'bsrc_new',
      { id: 'user_maxine', name: 'Maxine', role: OpsUserRole.PmcmAdmin, email: 'maxine@pmcm.test' },
      actor,
      undefined,
    );
    expect(paymentOperationsService.recordPayment).toHaveBeenCalledWith(
      'evt_sample',
      'pay_downpayment',
      { amountReceived: 50000, paymentDate: '2026-06-20', paymentMethod: 'Bank Transfer' },
      { id: 'user_maxine', name: 'Maxine', role: OpsUserRole.PmcmAdmin, email: 'maxine@pmcm.test' },
    );
    expect(billingAdjustmentService.requestBillingCorrection).toHaveBeenCalledWith(
      'evt_sample',
      { statementId: 'bill_new', reason: 'Tax line is incorrect', idempotencyKey: 'corr-controller-1' },
      { id: 'user_maxine', name: 'Maxine', role: OpsUserRole.PmcmAdmin, email: 'maxine@pmcm.test' },
    );
    expect(billingAdjustmentService.resolveBillingCorrection).toHaveBeenCalledWith('evt_sample', 'corr_new', { action: 'approve' }, expect.objectContaining({ id: 'user_maxine' }));
    expect(billingAdjustmentService.createBillingDispute).toHaveBeenCalledWith('evt_sample', { statementId: 'bill_new', amount: 500, reason: 'Duplicate charge', idempotencyKey: 'dispute-controller-1' }, expect.objectContaining({ id: 'user_maxine' }));
    expect(billingAdjustmentService.resolveBillingDispute).toHaveBeenCalledWith('evt_sample', 'dispute_new', { action: 'resolve', resolutionNotes: 'Reviewed' }, expect.objectContaining({ id: 'user_maxine' }));
    expect(billingAdjustmentService.createAdditionalBilling).toHaveBeenCalledWith('evt_sample', { urgentIssueId: 'issue_new', description: 'Overtime', amount: 500, idempotencyKey: 'additional-controller-1' }, expect.objectContaining({ id: 'user_maxine' }));
    expect(billingAdjustmentService.waiveAdditionalBilling).toHaveBeenCalledWith('evt_sample', 'addbill_new', { reason: 'Approved goodwill' }, expect.objectContaining({ id: 'user_maxine' }));
  });

  it('blocks an otherwise authorized actor with no ID before invoking billing commands', async () => {
    const { controller, paymentOperationsService, eventAccessPolicyService } = createController();
    eventAccessPolicyService.resolveActor.mockReturnValueOnce({
      id: undefined,
      role: OpsUserRole.PmcmAdmin,
      name: 'Maxine',
      email: 'maxine@pmcm.test',
    });

    await expect(
      controller.markPayment(
        'evt_sample',
        'pay_downpayment',
        { status: 'paid' },
        { actorId: 'user_maxine', actorRole: OpsUserRole.PmcmAdmin, actorName: 'Maxine' } as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(paymentOperationsService.markPayment).not.toHaveBeenCalled();
  });
  it('blocks non-finance actors before invoking billing commands', async () => {
    const { controller, billingOperationsService, billingAdjustmentService, eventAccessPolicyService } = createController();
    eventAccessPolicyService.requireActorRole
      .mockRejectedValueOnce(new ForbiddenException('client cannot access billing source'))
      .mockRejectedValueOnce(new ForbiddenException('client cannot access billing dispute'));
    const client = { id: 'user_ana', actorId: 'user_ana', actorRole: OpsUserRole.Client, actorName: 'Ana Reyes' } as never;

    await expect(
      controller.createBillingSource(
        'evt_sample',
        { sourceLabel: 'Conforme billing', lineItems: [{ label: 'Package', amount: 100000 }] },
        client,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.createBillingDispute(
        'evt_sample',
        { statementId: 'bill_new', amount: 500, reason: 'Duplicate charge', idempotencyKey: 'forbidden-dispute' },
        client,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(billingOperationsService.createBillingSource).not.toHaveBeenCalled();
    expect(billingAdjustmentService.createBillingDispute).not.toHaveBeenCalled();
  });
});
