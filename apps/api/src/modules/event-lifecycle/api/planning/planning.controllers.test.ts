import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventPlanController } from './event-plan.controller';
import { PlanningTemplatesController } from './planning-templates.controller';

const verified = (role: string, id: string | undefined = 'user_pmcm') =>
  ({ id, actorId: id, actorRole: role, actorName: 'PMCM Planner', actorEmail: 'planner@pmcm.test', expiresAt: '2099-01-01' }) as never;

const policy = () => ({
  // The role the verified session carries is the only identity a controller may use.
  resolveActor: vi.fn((_input: unknown, session: { id?: string; actorRole: string; actorName: string; actorEmail?: string }) => ({
    id: session.id, role: session.actorRole, name: session.actorName, email: session.actorEmail,
  })),
  requireActorRole: vi.fn(async (actor: { role: string }, roles: readonly string[]) => {
    if (!roles.includes(actor.role)) throw new ForbiddenException('Actor is not authorized');
  }),
});

function templatesFixture() {
  const service = {
    list: vi.fn(async () => []), get: vi.fn(async () => ({})), create: vi.fn(async () => ({})),
    publishVersion: vi.fn(async () => ({})), setArchived: vi.fn(async () => ({})),
  };
  return { controller: new PlanningTemplatesController(service as never, policy() as never), service };
}

function planFixture() {
  const service = {
    listItems: vi.fn(async () => []), preview: vi.fn(async () => ({})), apply: vi.fn(async () => ({})), updateItem: vi.fn(async () => ({})),
  };
  return { controller: new EventPlanController(service as never, policy() as never), service };
}

const dto = {} as never;
type Case<C, S> = [string, (controller: C, actor: never) => Promise<unknown>, keyof S];
const templateCalls: Array<Case<PlanningTemplatesController, ReturnType<typeof templatesFixture>['service']>> = [
  ['list', (c, a) => c.list(a), 'list'],
  ['get', (c, a) => c.get('ptpl_1', a), 'get'],
  ['create', (c, a) => c.create(dto, a), 'create'],
  ['publishVersion', (c, a) => c.publishVersion('ptpl_1', dto, a), 'publishVersion'],
  ['archive', (c, a) => c.archive('ptpl_1', a), 'setArchived'],
  ['restore', (c, a) => c.restore('ptpl_1', a), 'setArchived'],
];
const planCalls: Array<Case<EventPlanController, ReturnType<typeof planFixture>['service']>> = [
  ['list', (c, a) => c.list('evt_1', a), 'listItems'],
  ['preview', (c, a) => c.preview('evt_1', dto, a), 'preview'],
  ['apply', (c, a) => c.apply('evt_1', dto, a), 'apply'],
  ['updateItem', (c, a) => c.updateItem('evt_1', 'plan_1', dto, a), 'updateItem'],
];
const refused = [OpsUserRole.Client, OpsUserRole.Supplier, OpsUserRole.Coordinator, OpsUserRole.Guest, OpsUserRole.Unknown];

describe('planning controllers', () => {
  it('serve templates apart from any event, and plans under the event', () => {
    expect(Reflect.getMetadata('path', PlanningTemplatesController)).toBe('planning-templates');
    expect(Reflect.getMetadata('path', EventPlanController)).toBe('events');
  });

  it.each(templateCalls)('template %s is PMCM only: clients, suppliers, coordinators, guests and unknown roles reach nothing', async (_name, call, method) => {
    for (const role of refused) {
      const { controller, service } = templatesFixture();
      await expect(call(controller, verified(role))).rejects.toThrow(ForbiddenException);
      expect(service[method]).not.toHaveBeenCalled();
    }
  });

  it.each(planCalls)('plan %s is PMCM only: clients, suppliers, coordinators, guests and unknown roles reach nothing', async (_name, call, method) => {
    for (const role of refused) {
      const { controller, service } = planFixture();
      await expect(call(controller, verified(role))).rejects.toThrow(ForbiddenException);
      expect(service[method]).not.toHaveBeenCalled();
    }
  });

  it('needs a verified actor id even from an allowed role', async () => {
    const templates = templatesFixture();
    const plans = planFixture();
    await expect(templateCalls[2]![1](templates.controller, verified(OpsUserRole.PmcmAdmin, ' '))).rejects.toThrow(ForbiddenException);
    await expect(planCalls[2]![1](plans.controller, verified(OpsUserRole.PmcmAdmin, ' '))).rejects.toThrow(ForbiddenException);
    expect(templates.service.create).not.toHaveBeenCalled();
    expect(plans.service.apply).not.toHaveBeenCalled();
  });

  it('lets PMCM and the system act, naming the verified account rather than anything the caller sent', async () => {
    for (const role of [OpsUserRole.PmcmAdmin, OpsUserRole.System]) {
      const templates = templatesFixture();
      const plans = planFixture();
      await templates.controller.create(dto, verified(role, 'user_7'));
      await plans.controller.apply('evt_1', dto, verified(role, 'user_7'));
      await plans.controller.updateItem('evt_1', 'plan_1', dto, verified(role, 'user_7'));
      const expected = { id: 'user_7', name: 'PMCM Planner', role, email: 'planner@pmcm.test' };
      expect(templates.service.create).toHaveBeenCalledWith(dto, expected);
      expect(plans.service.apply).toHaveBeenCalledWith('evt_1', dto, expected);
      expect(plans.service.updateItem).toHaveBeenCalledWith('evt_1', 'plan_1', dto, expected);
    }
  });
});
