import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { EventSessionGuard } from '@prism/kernel/event-session';
import { ZodValidationPipe } from '@prism/kernel/shared';
import { OpsPmcmSupplierEngagementsController } from './pmcm-supplier-engagements.controller';

describe('OpsPmcmSupplierEngagementsController', () => {
  it('keeps the PMCM base and guards the event engagement route with a verified session', () => {
    expect(Reflect.getMetadata('path', OpsPmcmSupplierEngagementsController)).toBe('pmcm');
    expect(Reflect.getMetadata('path', OpsPmcmSupplierEngagementsController.prototype.listEngagements)).toBe('suppliers/:supplierId/engagements');
    expect(Reflect.getMetadata('__guards__', OpsPmcmSupplierEngagementsController.prototype.listEngagements)).toContain(EventSessionGuard);
  });

  it('validates paging with the shared history query schema and passes the verified actor', async () => {
    const readModel = { listEngagements: vi.fn(async () => ({ items: [] })) };
    const policy = { resolveActor: vi.fn((_input, actor) => ({ role: actor.actorRole, name: actor.actorName })) };
    const controller = new OpsPmcmSupplierEngagementsController(readModel as any, policy as any);
    const verifiedActor = { actorId: 'user_maxine', actorRole: 'pmcm-admin', actorName: 'Maxine' };
    const routeArguments = Reflect.getMetadata('__routeArguments__', OpsPmcmSupplierEngagementsController, 'listEngagements') as
      Record<string, { index: number; pipes?: unknown[] }>;
    const queryPipe = Object.values(routeArguments).find((argument) => argument.index === 1)?.pipes?.[0];

    expect(queryPipe).toBeInstanceOf(ZodValidationPipe);
    await expect(controller.listEngagements('sup_1', { page: 2, pageSize: 25 }, verifiedActor as any)).resolves.toEqual({ items: [] });
    expect(policy.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(readModel.listEngagements).toHaveBeenCalledWith('sup_1', { page: 2, pageSize: 25 }, { role: 'pmcm-admin', name: 'Maxine' });
  });
});
