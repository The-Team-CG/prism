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
    markPayment: vi.fn(async () => ({ id: 'pay_downpayment', status: 'paid' })),
    recordPayment: vi.fn(async () => ({ id: 'pay_downpayment', amountPaid: 50000 })),
    sendBillingStatement: vi.fn(async () => ({ id: 'bill_new', status: 'sent' })),
  };
  const eventAccessPolicyService = {
    resolveActor: vi.fn((input = {}, verified?: any) => ({
      role: verified?.actorRole ?? input.actorRole ?? OpsUserRole.PmcmAdmin,
      name: verified?.actorName ?? input.actorName ?? 'PMCM Admin',
      email: verified?.actorEmail ?? input.actorEmail,
    })),
    requireActorRole: vi.fn(async () => undefined),
  };
  const controller = new OpsEventBillingController(
    billingOperationsService as any,
    eventAccessPolicyService as any,
  );
  return { controller, billingOperationsService, eventAccessPolicyService };
}

describe('OpsEventBillingController', () => {
  it('keeps event billing routes under the events route base', () => {
    expect(controllerPath(OpsEventBillingController)).toBe('events');
  });

  it('serves billing commands through FinanceOps with PMCM route policy', async () => {
    const { controller, billingOperationsService, eventAccessPolicyService } = createController();
    const actor = { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Maxine', actorEmail: 'maxine@pmcm.test' };

    await expect(
      controller.createBillingSource(
        'evt_sample',
        { sourceLabel: 'Conforme billing', lineItems: [{ label: 'Package', amount: 100000 }] },
        actor as never,
      ),
    ).resolves.toEqual({ id: 'bsrc_new' });
    await expect(controller.approveBillingSource('evt_sample', 'bsrc_new', { approvedBy: 'Maxine' }, actor as never)).resolves.toEqual({
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

    expect(eventAccessPolicyService.requireActorRole).toHaveBeenCalledTimes(6);
    expect(eventAccessPolicyService.requireActorRole).toHaveBeenCalledWith(
      { role: OpsUserRole.PmcmAdmin, name: 'Maxine', email: 'maxine@pmcm.test' },
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'billing source',
      'evt_sample',
    );
    expect(billingOperationsService.createBillingSource).toHaveBeenCalledWith(
      'evt_sample',
      { sourceLabel: 'Conforme billing', lineItems: [{ label: 'Package', amount: 100000 }] },
      { name: 'Maxine', role: OpsUserRole.PmcmAdmin, email: 'maxine@pmcm.test' },
    );
    expect(billingOperationsService.generateBillingStatement).toHaveBeenCalledWith(
      'evt_sample',
      'bsrc_new',
      { name: 'Maxine', role: OpsUserRole.PmcmAdmin, email: 'maxine@pmcm.test' },
    );
    expect(billingOperationsService.recordPayment).toHaveBeenCalledWith(
      'evt_sample',
      'pay_downpayment',
      { amountReceived: 50000, paymentDate: '2026-06-20', paymentMethod: 'Bank Transfer' },
      { name: 'Maxine', role: OpsUserRole.PmcmAdmin, email: 'maxine@pmcm.test' },
    );
  });

  it('blocks non-finance actors before invoking billing commands', async () => {
    const { controller, billingOperationsService, eventAccessPolicyService } = createController();
    eventAccessPolicyService.requireActorRole.mockRejectedValueOnce(
      new ForbiddenException('client cannot access billing source'),
    );

    await expect(
      controller.createBillingSource(
        'evt_sample',
        { sourceLabel: 'Conforme billing', lineItems: [{ label: 'Package', amount: 100000 }] },
        { actorRole: OpsUserRole.Client, actorName: 'Ana Reyes' } as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(billingOperationsService.createBillingSource).not.toHaveBeenCalled();
  });
});
