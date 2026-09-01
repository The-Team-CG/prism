import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { OpsEventCommercialController } from './event-commercial.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

function createController() {
  const now = new Date('2026-06-20T08:00:00.000Z');
  const request = {
    id: 'qr_sample',
    eventId: 'evt_sample',
    supplierId: 'sup_technical',
    categoryId: 'supcat_technical',
    supplierName: 'SonicLine Technicals',
    category: 'Technicals',
    message: 'Ana Reyes / Ayala Tech Summit quote request.',
    dueDate: new Date('2026-06-25T00:00:00.000Z'),
    accessToken: 'token-sample',
    confidentialBid: false,
    status: 'open',
    createdAt: now,
  };
  const quote = {
    id: 'quote_sample',
    eventId: 'evt_sample',
    requestId: 'qr_sample',
    supplierId: 'sup_technical',
    categoryId: 'supcat_technical',
    supplierName: 'SonicLine Technicals',
    category: 'Technicals',
    amount: 180000,
    inclusions: ['Audio', 'Lights'],
    paymentTerms: '50% down',
    notes: 'Valid for 15 days',
    acceptableMin: 120000,
    acceptableMax: 180000,
    outsideAcceptableRange: false,
    status: 'received',
    revisionNumber: 1,
    revisedAt: null,
    selectedAt: null,
    lockedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  const commercialWorkflowService = {
    addSupplierQuote: vi.fn(async () => quote),
    requestSupplierQuotes: vi.fn(async () => [request]),
    selectSupplierQuote: vi.fn(async () => ({ ...quote, status: 'selected', selectedAt: now, lockedAt: now })),
  };
  const eventAccessPolicyService = {
    resolveActor: vi.fn((input = {}) => ({
      role: input.actorRole ?? OpsUserRole.PmcmAdmin,
      name: input.actorName ?? 'PMCM Admin',
      email: input.actorEmail,
    })),
    requireActorRole: vi.fn(async () => undefined),
  };
  const controller = new OpsEventCommercialController(
    commercialWorkflowService as any,
    eventAccessPolicyService as any,
  );
  return { controller, commercialWorkflowService, eventAccessPolicyService };
}

describe('OpsEventCommercialController', () => {
  it('keeps event commercial command routes under the events route base', () => {
    expect(controllerPath(OpsEventCommercialController)).toBe('events');
  });

  it('serves event quote commands through CommercialOps with PMCM route policy', async () => {
    const { controller, commercialWorkflowService, eventAccessPolicyService } = createController();
    const actor = { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Maxine', actorEmail: 'maxine@pmcm.test' };

    await expect(
      controller.addSupplierQuote(
        'evt_sample',
        { requestId: 'qr_sample', supplierId: 'sup_technical', amount: 180000 },
        actor,
      ),
    ).resolves.toMatchObject({ id: 'quote_sample', amount: 180000 });
    await expect(
      controller.requestSupplierQuotes(
        'evt_sample',
        { categoryId: 'supcat_technical', supplierIds: ['sup_technical'], deadline: '2026-06-25' },
        actor,
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'qr_sample',
        dueDate: '2026-06-25',
        createdAt: '2026-06-20T08:00:00.000Z',
      }),
    ]);
    await expect(controller.selectSupplierQuote('evt_sample', 'quote_sample', actor)).resolves.toMatchObject({
      id: 'quote_sample',
      status: 'selected',
      selectedAt: '2026-06-20T08:00:00.000Z',
    });

    expect(eventAccessPolicyService.requireActorRole).toHaveBeenCalledTimes(3);
    expect(eventAccessPolicyService.requireActorRole).toHaveBeenCalledWith(
      { role: OpsUserRole.PmcmAdmin, name: 'Maxine', email: 'maxine@pmcm.test' },
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'supplier quote details',
      'evt_sample',
    );
    expect(commercialWorkflowService.addSupplierQuote).toHaveBeenCalledWith('evt_sample', {
      requestId: 'qr_sample',
      supplierId: 'sup_technical',
      amount: 180000,
    });
    expect(commercialWorkflowService.requestSupplierQuotes).toHaveBeenCalledWith('evt_sample', {
      categoryId: 'supcat_technical',
      supplierIds: ['sup_technical'],
      deadline: '2026-06-25',
    });
    expect(commercialWorkflowService.selectSupplierQuote).toHaveBeenCalledWith('evt_sample', 'quote_sample', 'Maxine');
  });

  it('blocks non-commercial actors before invoking commercial commands', async () => {
    const { controller, commercialWorkflowService, eventAccessPolicyService } = createController();
    eventAccessPolicyService.requireActorRole.mockRejectedValueOnce(
      new ForbiddenException('client cannot access supplier quote details'),
    );

    await expect(
      controller.addSupplierQuote(
        'evt_sample',
        { requestId: 'qr_sample', supplierId: 'sup_technical', amount: 180000 },
        { actorRole: OpsUserRole.Client, actorName: 'Ana Reyes' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(commercialWorkflowService.addSupplierQuote).not.toHaveBeenCalled();
  });
});
