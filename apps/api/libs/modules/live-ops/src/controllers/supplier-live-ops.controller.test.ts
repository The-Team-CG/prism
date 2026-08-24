import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { EventAccessPolicyService } from '@prism/modules/access-control';
import { EventSessionGuard } from '@prism/modules/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import type { EventLiveOpsCommandService } from '../services/event-live-ops-command.service';
import { SupplierLiveOpsController } from './supplier-live-ops.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

function verifiedActor(): PrismVerifiedEventActor {
  return {
    id: 'supplier_session',
    actorId: 'supplier_session',
    role: 'supplier',
    actorRole: 'supplier',
    email: 'supplier@pmcm.test',
    actorEmail: 'supplier@pmcm.test',
    name: 'Verified Supplier',
    actorName: 'Verified Supplier',
    expiresAt: '2026-08-25T00:00:00.000Z',
    supplierId: 'sup_technical',
  };
}

describe('SupplierLiveOpsController', () => {
  it('keeps supplier live-ops routes under the supplier route base', () => {
    expect(controllerPath(SupplierLiveOpsController)).toBe('supplier');
  });

  it('delegates supplier event-day status with stable route parameters', async () => {
    const commandService = { updateSupplierEventStatus: vi.fn(async () => ({ id: 'qr_sample' })) };
    const actor = { role: 'supplier', name: 'Verified Supplier', email: 'supplier@pmcm.test' };
    const eventAccessPolicyService = { resolveActor: vi.fn(() => actor) };
    const controller = new SupplierLiveOpsController(
      commandService as unknown as EventLiveOpsCommandService,
      eventAccessPolicyService as unknown as EventAccessPolicyService,
    );
    const sessionActor = verifiedActor();
    const dto = { status: 'arrived' as const, notes: 'At dock', photo: { fileName: 'dock.jpg' } };

    await controller.updateEventStatus('qr_sample', dto, {}, sessionActor);

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, sessionActor);
    expect(commandService.updateSupplierEventStatus).toHaveBeenCalledWith('qr_sample', dto, actor);
  });

  it('requires a verified session actor and ignores spoofed query actor details', async () => {
    const guards = Reflect.getMetadata('__guards__', SupplierLiveOpsController.prototype.updateEventStatus);
    expect(guards).toContain(EventSessionGuard);

    const resolvedActor = { role: 'supplier', name: 'Verified Supplier', email: 'supplier@pmcm.test' };
    const eventAccessPolicyService = {
      resolveActor: vi.fn(() => resolvedActor),
    };
    const commandService = { updateSupplierEventStatus: vi.fn(async () => ({ id: 'qr_sample' })) };
    const controller = new SupplierLiveOpsController(
      commandService as unknown as EventLiveOpsCommandService,
      eventAccessPolicyService as unknown as EventAccessPolicyService,
    );
    const spoofedQuery = { actorRole: 'supplier', actorName: 'Spoofed Supplier', supplierId: 'spoofed_supplier' };
    const sessionActor = verifiedActor();
    const dto = { status: 'arrived' as const, notes: 'At dock', photo: { fileName: 'dock.jpg' } };

    await controller.updateEventStatus('qr_sample', dto, spoofedQuery, sessionActor);

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, sessionActor);
    expect(commandService.updateSupplierEventStatus).toHaveBeenCalledWith('qr_sample', dto, resolvedActor);
  });
});
