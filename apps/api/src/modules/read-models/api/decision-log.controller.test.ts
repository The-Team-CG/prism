import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { decisionLogQuerySchema } from '@prism/types';
import { EventSessionGuard } from '@prism/kernel/event-session';
import { zodQuery } from '@prism/kernel/shared';
import { OpsDecisionLogController } from './decision-log.controller';

describe('OpsDecisionLogController', () => {
  it('serves GET events/:eventId/decision-log only behind a verified session', () => {
    expect(Reflect.getMetadata('path', OpsDecisionLogController)).toBe('events');
    expect(Reflect.getMetadata('path', OpsDecisionLogController.prototype.decisionLog)).toBe(':eventId/decision-log');
    expect(Reflect.getMetadata('__guards__', OpsDecisionLogController.prototype.decisionLog)).toContain(EventSessionGuard);
  });

  it('rejects unknown kinds and out-of-range paging before the service is reached', () => {
    const pipe = zodQuery(decisionLogQuerySchema);
    for (const invalid of [{ kind: 'audit' }, { pageSize: '500' }]) {
      expect(() => pipe.transform(invalid, { type: 'query' })).toThrow(BadRequestException);
    }
  });

  it('resolves the actor from the verified session and forwards the parsed filters', async () => {
    const decisionLogService = { getDecisionLog: vi.fn(async () => ({ eventId: 'evt_1', entries: [] })) };
    const eventAccessPolicyService = { resolveActor: vi.fn((_input: unknown, verified: { actorRole: string }) => ({ role: verified.actorRole })) };
    const controller = new OpsDecisionLogController(decisionLogService as never, eventAccessPolicyService as never);
    const verifiedActor = { id: 'user_pmcm', actorId: 'user_pmcm', role: 'pmcm-admin', actorRole: 'pmcm-admin', name: 'Ms. Mys', actorName: 'Ms. Mys' };

    await controller.decisionLog('evt_1', { kind: 'addendum', page: 1, pageSize: 10 }, verifiedActor as never);

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(decisionLogService.getDecisionLog).toHaveBeenCalledWith('evt_1', { role: 'pmcm-admin' }, { kind: 'addendum', page: 1, pageSize: 10 });
  });
});
