import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsAiGovernanceController } from './ai-governance.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsAiGovernanceController', () => {
  const actor = { id: 'u1', actorId: 'u1', role: 'pmcm-admin' as const, actorRole: 'pmcm-admin' as const, email: 'admin@example.test', actorEmail: 'admin@example.test', name: 'Admin', actorName: 'Admin', expiresAt: '2099-01-01T00:00:00.000Z' };
  it('keeps the public AI route base stable under ai-governance ownership', () => {
    expect(controllerPath(OpsAiGovernanceController)).toBe('ai');
  });

  it('serves AI governance dry-runs through AiGovernanceService', async () => {
    const aiGovernanceService = {
      runDryRun: vi.fn(async () => ({ audit: { id: 'aia_1' }, approval: { id: 'aip_1' } })),
    };
    const controller = new OpsAiGovernanceController(aiGovernanceService as any);
    const dto = {
      eventId: 'evt_sample',
      featureName: 'PEIL',
      modelVersion: 'sample-model',
      zdrConfirmed: true,
      payload: { clientName: 'Ana Reyes' },
    };

    await expect(controller.dryRun(dto, actor)).resolves.toEqual({ audit: { id: 'aia_1' }, approval: { id: 'aip_1' } });
    expect(aiGovernanceService.runDryRun).toHaveBeenCalledWith(dto, expect.objectContaining({
      id: 'u1',
      role: 'pmcm-admin',
      name: 'Admin',
      email: 'admin@example.test',
      explicit: true,
      verified: true,
    }));
  });

  it('rejects non-trust actors before calling the governance service', async () => {
    const aiGovernanceService = { runDryRun: vi.fn() };
    const controller = new OpsAiGovernanceController(aiGovernanceService as any);
    const dto = { featureName: 'PEIL', modelVersion: 'test', zdrConfirmed: true, payload: {} };

    expect(() => controller.dryRun(dto as any, { ...actor, role: 'client', actorRole: 'client' } as any)).toThrow(
      'Only trust operators can run AI governance dry-runs',
    );
    expect(aiGovernanceService.runDryRun).not.toHaveBeenCalled();
  });
});
