import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { PaymentReceiptsController } from './payment-receipts.controller';

const verified = (role: string, id: string | undefined = 'user_finance') =>
  ({ id, actorId: id, actorRole: role, actorName: 'Finance Operator', actorEmail: 'finance@pmcm.test', expiresAt: '2099-01-01' }) as never;

function createController() {
  const receipt = { id: 'prcp_1' };
  const service = {
    listReceipts: vi.fn(async () => [receipt]),
    listAllocationTargets: vi.fn(async () => []),
    getReceipt: vi.fn(async () => receipt),
    recordReceipt: vi.fn(async () => receipt),
    allocate: vi.fn(async () => receipt),
    reverseAllocation: vi.fn(async () => receipt),
    verify: vi.fn(async () => receipt),
    reject: vi.fn(async () => receipt),
    reverseReceipt: vi.fn(async () => receipt),
    recordRefund: vi.fn(async () => receipt),
  };
  const policy = {
    // The role the verified session carries is the only identity the controller may use.
    resolveActor: vi.fn((_input: unknown, session: { id?: string; actorRole: string; actorName: string; actorEmail?: string }) => ({
      id: session.id, role: session.actorRole, name: session.actorName, email: session.actorEmail,
    })),
    requireActorRole: vi.fn(async (actor: { role: string }, roles: readonly string[]) => {
      if (!roles.includes(actor.role)) throw new ForbiddenException('Actor is not authorized');
    }),
  };
  return { controller: new PaymentReceiptsController(service as never, policy as never), service };
}

type Controller = PaymentReceiptsController;
const dto = {} as never;
const calls: Array<[string, (controller: Controller, actor: never) => Promise<unknown>, keyof ReturnType<typeof createController>['service']]> = [
  ['list', (c, a) => c.list(dto, a), 'listReceipts'],
  ['allocationTargets', (c, a) => c.allocationTargets({ eventId: 'evt_1' }, a), 'listAllocationTargets'],
  ['get', (c, a) => c.get('prcp_1', a), 'getReceipt'],
  ['record', (c, a) => c.record(dto, a), 'recordReceipt'],
  ['allocate', (c, a) => c.allocate('prcp_1', dto, a), 'allocate'],
  ['reverseAllocation', (c, a) => c.reverseAllocation('prcp_1', 'payrec_1', dto, a), 'reverseAllocation'],
  ['verify', (c, a) => c.verify('prcp_1', dto, a), 'verify'],
  ['reject', (c, a) => c.reject('prcp_1', dto, a), 'reject'],
  ['reverse', (c, a) => c.reverse('prcp_1', dto, a), 'reverseReceipt'],
  ['refund', (c, a) => c.refund('prcp_1', dto, a), 'recordRefund'],
];

describe('PaymentReceiptsController', () => {
  it('serves the receipt routes under their own base, apart from any one event', () => {
    expect(Reflect.getMetadata('path', PaymentReceiptsController)).toBe('payment-receipts');
  });

  it.each(calls)('%s is for PMCM finance only: clients, suppliers, coordinators, guests and unknown roles reach nothing', async (_name, call, method) => {
    for (const role of [OpsUserRole.Client, OpsUserRole.Supplier, OpsUserRole.Coordinator, OpsUserRole.Guest, OpsUserRole.Unknown]) {
      const { controller, service } = createController();
      await expect(call(controller, verified(role))).rejects.toThrow(ForbiddenException);
      expect(service[method]).not.toHaveBeenCalled();
    }
  });

  it.each(calls)('%s needs a verified actor id even from an otherwise allowed role', async (_name, call, method) => {
    const { controller, service } = createController();
    await expect(call(controller, verified(OpsUserRole.PmcmAdmin, ' '))).rejects.toThrow(ForbiddenException);
    expect(service[method]).not.toHaveBeenCalled();
  });

  it('lets PMCM and the system act, naming the verified account rather than anything the caller sent', async () => {
    for (const role of [OpsUserRole.PmcmAdmin, OpsUserRole.System]) {
      const { controller, service } = createController();
      await controller.record({ amount: 1000 } as never, verified(role));
      expect(service.recordReceipt).toHaveBeenCalledWith({ amount: 1000 }, { id: 'user_finance', name: 'Finance Operator', role, email: 'finance@pmcm.test' });
    }
  });
});
