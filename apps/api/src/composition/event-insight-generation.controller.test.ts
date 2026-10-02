import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { OpsUserRole } from '@prism/kernel/event-core';
import { describe, expect, it, vi } from 'vitest';
import { EventInsightGenerationController } from './event-insight-generation.controller';

describe('EventInsightGenerationController', () => {
  it('preserves the event insight generation route and resolves the verified actor', async () => {
    const insight = {
      id: 'ins_1',
      eventId: 'evt_1',
      summary: 'Closed cleanly',
      highlights: [],
      risks: [],
      supplierNotes: [],
      financialSummary: {},
      documentSummary: {},
      feedbackSummary: {},
      dimensions: { coordinators: { status: 'evidence', summary: '2 assignments', evidence: ['assignments:2'] } },
      privateNotes: 'PMCM only',
      generatedAt: new Date('2026-09-08T00:00:00.000Z'),
      updatedAt: new Date('2026-09-08T00:00:00.000Z'),
    };
    const service = { generate: vi.fn(async () => insight) };
    const access = {
      resolveActor: vi.fn(() => ({ id: 'pmcm_1', role: OpsUserRole.PmcmAdmin, name: 'PMCM', email: 'pmcm@test' })),
    };
    const controller = new EventInsightGenerationController(service as never, access as never);

    expect(Reflect.getMetadata(PATH_METADATA, EventInsightGenerationController)).toBe('events');
    expect(Reflect.getMetadata(PATH_METADATA, EventInsightGenerationController.prototype.generate)).toBe(':eventId/insights/generate');
    expect(Reflect.getMetadata(METHOD_METADATA, EventInsightGenerationController.prototype.generate)).toBe(RequestMethod.POST);

    await expect(controller.generate('evt_1', {
      actorId: 'pmcm_1', actorRole: OpsUserRole.PmcmAdmin, actorName: 'PMCM', actorEmail: 'pmcm@test',
    } as never)).resolves.toMatchObject({
      id: 'ins_1',
      dimensions: { coordinators: { summary: '2 assignments' } },
    });
    expect(access.resolveActor).toHaveBeenCalledWith({}, expect.objectContaining({ actorId: 'pmcm_1' }));
    expect(service.generate).toHaveBeenCalledWith('evt_1', expect.objectContaining({ role: OpsUserRole.PmcmAdmin }));
  });
});
