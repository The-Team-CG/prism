import 'reflect-metadata';
import { PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import { OpsEventComplianceController } from './event-compliance.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata(PATH_METADATA, controller);
}

function complianceCheck(overrides: Record<string, unknown> = {}) {
  return {
    id: 'chk_contracts',
    eventId: 'evt_sample',
    ruleId: 'crule_contracts',
    layer: 'Must-Fix',
    severity: 'must_fix',
    phase: 'planning',
    conditionKey: 'contracts_ready',
    title: 'Contracts ready',
    status: 'open',
    note: 'All supplier contracts must be uploaded.',
    resolvedAt: null,
    resolvedBy: null,
    overrideReason: null,
    overrideAt: null,
    overrideBy: null,
    ...overrides,
  };
}

describe('OpsEventComplianceController', () => {
  it('keeps event-scoped compliance routes under the events route base', () => {
    expect(controllerPath(OpsEventComplianceController)).toBe('events');
  });

  it('serves event-scoped compliance checks through ComplianceWorkflowService', async () => {
    const complianceWorkflowService = {
      runCompliance: vi.fn(async () => [complianceCheck()]),
      resolveCompliance: vi.fn(async () =>
        complianceCheck({
          status: 'resolved',
          resolvedAt: new Date('2026-06-20T09:30:00.000Z'),
          resolvedBy: 'Maxine',
        }),
      ),
    };
    const controller = new OpsEventComplianceController(complianceWorkflowService as any);

    await expect(controller.runCompliance('evt_sample', { phase: 'planning' })).resolves.toEqual([
      expect.objectContaining({ id: 'chk_contracts', eventId: 'evt_sample', status: 'open' }),
    ]);
    await expect(controller.resolveCompliance('evt_sample', 'chk_contracts', { note: 'Done' })).resolves.toEqual(
      expect.objectContaining({
        id: 'chk_contracts',
        status: 'resolved',
        resolvedAt: '2026-06-20T09:30:00.000Z',
      }),
    );

    expect(complianceWorkflowService.runCompliance).toHaveBeenCalledWith('evt_sample', { phase: 'planning' });
    expect(complianceWorkflowService.resolveCompliance).toHaveBeenCalledWith('evt_sample', 'chk_contracts', {
      note: 'Done',
    });
  });
});