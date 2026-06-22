import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsAuditController, OpsPrivacyController } from './audit-privacy.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('trust-ops audit/privacy controllers', () => {
  it('keeps public audit and privacy route bases stable under trust ownership', () => {
    expect(controllerPath(OpsAuditController)).toBe('audit');
    expect(controllerPath(OpsPrivacyController)).toBe('privacy');
  });

  it('serves audit routes through AuditService with PMCM/system guard', async () => {
    const auditService = {
      listAuditLogs: vi.fn(async () => [{ id: 'aud_1' }]),
      exportAuditLogs: vi.fn(async () => ({ rows: [{ id: 'aud_1' }] })),
      listSecurityAlerts: vi.fn(async () => [{ id: 'alert_1' }]),
      verifyIntegrity: vi.fn(async () => ({ valid: true })),
      audit: vi.fn(async () => ({ id: 'aud_forbidden' })),
    };
    const controller = new OpsAuditController(auditService as any);

    await expect(controller.listLogs({ actorRole: 'pmcm-admin', limit: '25' })).resolves.toEqual([{ id: 'aud_1' }]);
    await expect(controller.exportLogs({ actorRole: 'system', limit: '25' })).resolves.toEqual({ rows: [{ id: 'aud_1' }] });
    await expect(controller.listAlerts({ actorRole: 'pmcm-admin' })).resolves.toEqual([{ id: 'alert_1' }]);
    await expect(controller.integrity({ actorRole: 'pmcm-admin' })).resolves.toEqual({ valid: true });

    expect(auditService.listAuditLogs).toHaveBeenCalledWith({ actorRole: 'pmcm-admin', limit: '25' });
    expect(auditService.exportAuditLogs).toHaveBeenCalledWith({ actorRole: 'system', limit: '25' });
    expect(auditService.listSecurityAlerts).toHaveBeenCalledTimes(1);
    expect(auditService.verifyIntegrity).toHaveBeenCalledTimes(1);
  });

  it('serves privacy routes through PrivacyOperationsService with PMCM/system guard', async () => {
    const privacyOperationsService = {
      getInventory: vi.fn(async () => ({ events: [] })),
      listRetentionPolicies: vi.fn(() => [{ surface: 'audit' }]),
      listRequests: vi.fn(async () => [{ id: 'priv_1' }]),
      createRequest: vi.fn(async () => ({ id: 'priv_2' })),
      reviewRequest: vi.fn(async () => ({ id: 'priv_2', status: 'approved' })),
      executeRequest: vi.fn(async () => ({ id: 'priv_2', status: 'executed' })),
    };
    const auditService = { audit: vi.fn(async () => ({ id: 'aud_forbidden' })) };
    const controller = new OpsPrivacyController(privacyOperationsService as any, auditService as any);

    await expect(controller.inventory({ actorRole: 'pmcm-admin', eventId: 'evt_sample' })).resolves.toEqual({ events: [] });
    await expect(controller.retentionPolicies({ actorRole: 'pmcm-admin' })).resolves.toEqual([{ surface: 'audit' }]);
    await expect(controller.requests({ actorRole: 'pmcm-admin', status: 'submitted' })).resolves.toEqual([{ id: 'priv_1' }]);
    await expect(
      controller.createRequest(
        { subjectType: 'guest', subjectName: 'Ana', requestType: 'access', eventId: 'evt_sample' },
        { actorRole: 'pmcm-admin', actorName: 'Maxine' },
      ),
    ).resolves.toEqual({ id: 'priv_2' });
    await expect(controller.reviewRequest('priv_2', { status: 'approved' }, { actorRole: 'system' })).resolves.toEqual({
      id: 'priv_2',
      status: 'approved',
    });
    await expect(controller.executeRequest('priv_2', { executionNotes: 'Done' }, { actorRole: 'system' })).resolves.toEqual({
      id: 'priv_2',
      status: 'executed',
    });

    expect(privacyOperationsService.getInventory).toHaveBeenCalledWith({ actorRole: 'pmcm-admin', eventId: 'evt_sample' });
    expect(privacyOperationsService.createRequest).toHaveBeenCalledWith(
      { subjectType: 'guest', subjectName: 'Ana', requestType: 'access', eventId: 'evt_sample' },
      { name: 'Maxine', role: 'pmcm-admin' },
    );
  });

  it('records a forbidden audit event before rejecting non-trust actors', async () => {
    const auditService = {
      listAuditLogs: vi.fn(async () => []),
      audit: vi.fn(async () => ({ id: 'aud_forbidden' })),
    };
    const controller = new OpsAuditController(auditService as any);

    await expect(controller.listLogs({ actorRole: 'client', clientName: 'Ana Reyes' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(auditService.audit).toHaveBeenCalledWith(
      undefined,
      'Ana Reyes',
      '403 forbidden access: audit logs',
      expect.objectContaining({
        actorRole: 'client',
        actionType: 'forbidden_access',
        affectedLabel: 'audit logs',
      }),
    );
    expect(auditService.listAuditLogs).not.toHaveBeenCalled();
  });
});
