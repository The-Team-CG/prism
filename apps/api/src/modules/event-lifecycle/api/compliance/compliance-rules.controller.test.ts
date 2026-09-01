import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsComplianceController } from './compliance-rules.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

function rule(overrides: Record<string, unknown> = {}) {
  const createdAt = new Date('2026-06-01T00:00:00.000Z');
  return {
    id: 'crule_contracts',
    eventId: null,
    eventType: 'Corporate Summit',
    phase: 'planning',
    severity: 'must_fix',
    layer: 'Must-Fix',
    conditionKey: 'contracts_ready',
    title: 'Contracts ready',
    note: 'All supplier contracts must be uploaded.',
    active: true,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

describe('OpsComplianceController', () => {
  it('keeps the public compliance route base stable under compliance-ops ownership', () => {
    expect(controllerPath(OpsComplianceController)).toBe('compliance');
  });

  it('serves compliance rule reads and writes through ComplianceWorkflowService', async () => {
    const actor = { role: 'pmcm-admin', name: 'Maxine' };
    const complianceWorkflowService = {
      listComplianceRules: vi.fn(async () => [rule()]),
      createComplianceRule: vi.fn(async () => rule({ id: 'crule_new', title: 'New rule' })),
      updateComplianceRule: vi.fn(async () => rule({ id: 'crule_new', title: 'Updated rule' })),
    };
    const eventAccessPolicyService = {
      resolveActor: vi.fn(() => actor),
    };
    const controller = new OpsComplianceController(complianceWorkflowService as any, eventAccessPolicyService as any);
    const actorInput = { actorRole: 'pmcm-admin', actorName: 'Maxine' };

    await expect(controller.listRules(actorInput)).resolves.toEqual([
      expect.objectContaining({ id: 'crule_contracts', eventId: null, createdAt: '2026-06-01T00:00:00.000Z' }),
    ]);
    await expect(controller.createRule({ conditionKey: 'new_rule', title: 'New rule' }, actorInput)).resolves.toEqual(
      expect.objectContaining({ id: 'crule_new', title: 'New rule' }),
    );
    await expect(controller.updateRule('crule_new', { conditionKey: 'new_rule', title: 'Updated rule' }, actorInput)).resolves.toEqual(
      expect.objectContaining({ id: 'crule_new', title: 'Updated rule' }),
    );

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledTimes(3);
    expect(complianceWorkflowService.listComplianceRules).toHaveBeenCalledWith(actor);
    expect(complianceWorkflowService.createComplianceRule).toHaveBeenCalledWith(
      { conditionKey: 'new_rule', title: 'New rule' },
      actor,
    );
    expect(complianceWorkflowService.updateComplianceRule).toHaveBeenCalledWith(
      'crule_new',
      { conditionKey: 'new_rule', title: 'Updated rule' },
      actor,
    );
  });
});
