import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { SupplierLiveOpsController } from './supplier-live-ops.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('SupplierLiveOpsController', () => {
  it('keeps supplier live-ops routes under the supplier route base', () => {
    expect(controllerPath(SupplierLiveOpsController)).toBe('supplier');
  });

  it('delegates supplier event-day status with stable route parameters', async () => {
    const commandService = { updateSupplierEventStatus: vi.fn(async () => ({ id: 'qr_sample' })) };
    const controller = new SupplierLiveOpsController(commandService as any);
    const actor = { actorRole: 'supplier', supplierId: 'sup_technical' };
    const dto = { status: 'arrived', notes: 'At dock', photo: { fileName: 'dock.jpg' } };

    await controller.updateEventStatus('qr_sample', dto, actor);

    expect(commandService.updateSupplierEventStatus).toHaveBeenCalledWith('qr_sample', dto, actor);
  });
});