import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsAuditController, OpsPrivacyController } from './audit-privacy.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('trust-ops audit/privacy controllers', () => {
  const verified = (role: 'pmcm-admin' | 'system' | 'client' = 'pmcm-admin', name = 'PMCM Admin') => ({ id: 'u1', actorId: 'u1', role, actorRole: role, email: 'user@example.test', actorEmail: 'user@example.test', name, actorName: name, expiresAt: '2099-01-01T00:00:00.000Z' });
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

    await expect(controller.listLogs({ limit: '25' }, verified())).resolves.toEqual([{ id: 'aud_1' }]);
    await expect(controller.exportLogs({ limit: '25' }, verified('system'))).resolves.toEqual({ rows: [{ id: 'aud_1' }] });
    await expect(controller.listAlerts(verified())).resolves.toEqual([{ id: 'alert_1' }]);
    await expect(controller.integrity(verified())).resolves.toEqual({ valid: true });

    expect(auditService.listAuditLogs).toHaveBeenCalledWith({ limit: '25' });
    expect(auditService.exportAuditLogs).toHaveBeenCalledWith({ limit: '25' }, expect.objectContaining({ id: 'u1', role: 'system' }));
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

    await expect(controller.inventory({ eventId: 'evt_sample' }, verified())).resolves.toEqual({ events: [] });
    await expect(controller.retentionPolicies(verified())).resolves.toEqual([{ surface: 'audit' }]);
    await expect(controller.requests({ status: 'submitted' }, verified())).resolves.toEqual([{ id: 'priv_1' }]);
    await expect(
      controller.createRequest(
        { subjectType: 'guest', subjectName: 'Ana', requestType: 'access', eventId: 'evt_sample' },
        { ...verified('pmcm-admin', 'Maxine'), id: 'spoof', role: 'client', email: 'spoof@example.test', name: 'Spoofed' },
      ),
    ).resolves.toEqual({ id: 'priv_2' });
    await expect(controller.reviewRequest('priv_2', { status: 'approved' }, verified('system'))).resolves.toEqual({
      id: 'priv_2',
      status: 'approved',
    });
    await expect(controller.executeRequest('priv_2', { executionNotes: 'Done' }, verified('system'))).resolves.toEqual({
      id: 'priv_2',
      status: 'executed',
    });

    expect(privacyOperationsService.getInventory).toHaveBeenCalledWith({ eventId: 'evt_sample' });
    expect(privacyOperationsService.createRequest).toHaveBeenCalledWith(
      { subjectType: 'guest', subjectName: 'Ana', requestType: 'access', eventId: 'evt_sample' },
      expect.objectContaining({ id: 'u1', name: 'Maxine', role: 'pmcm-admin', explicit: true, verified: true }),
    );
    expect(privacyOperationsService.reviewRequest).toHaveBeenCalledWith(
      'priv_2',
      { status: 'approved' },
      expect.objectContaining({ id: 'u1', role: 'system', verified: true }),
    );
    expect(privacyOperationsService.executeRequest).toHaveBeenCalledWith(
      'priv_2',
      { executionNotes: 'Done' },
      expect.objectContaining({ id: 'u1', role: 'system', verified: true }),
    );
  });

  it('records a forbidden audit event before rejecting non-trust actors', async () => {
    const auditService = {
      listAuditLogs: vi.fn(async () => []),
      audit: vi.fn(async () => ({ id: 'aud_forbidden' })),
    };
    const controller = new OpsAuditController(auditService as any);

    await expect(controller.listLogs({}, verified('client', 'Ana Reyes'))).rejects.toBeInstanceOf(
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
