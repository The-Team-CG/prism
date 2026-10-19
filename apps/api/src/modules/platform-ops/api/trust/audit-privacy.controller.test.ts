import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { EventSessionGuard } from '@prism/kernel/event-session';
import { listPrivacyRequestsQuerySchema } from '@prism/types';
import { OpsAuditController, OpsPrivacyController } from './audit-privacy.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('trust-ops audit/privacy controllers', () => {
  const queue = (input: Record<string, string> = {}) => listPrivacyRequestsQuerySchema.parse(input);
  const verified = (role: 'pmcm-admin' | 'system' | 'client' | 'coordinator' | 'supplier' | 'guest' = 'pmcm-admin', name = 'PMCM Admin') => ({ id: 'u1', actorId: 'u1', role, actorRole: role, email: 'user@example.test', actorEmail: 'user@example.test', name, actorName: name, expiresAt: '2099-01-01T00:00:00.000Z' });
  it('keeps public audit and privacy route bases stable under trust ownership', () => {
    expect(controllerPath(OpsAuditController)).toBe('audit');
    expect(controllerPath(OpsPrivacyController)).toBe('privacy');
  });

  it('serves audit routes through read, export, and trust modules with PMCM/system guard', async () => {
    const auditService = {
      verifyIntegrity: vi.fn(async () => ({ valid: true })),
      audit: vi.fn(async () => ({ id: 'aud_forbidden' })),
    };
    const auditReadService = { listAuditLogs: vi.fn(async () => [{ id: 'aud_1' }]) };
    const auditExportService = { exportAuditLogs: vi.fn(async () => ({ rows: [{ id: 'aud_1' }] })) };
    const securityOperationsService = {
      listSecurityAlerts: vi.fn(async () => [{ id: 'alert_1' }]),
    };
    const controller = new OpsAuditController(auditService as never, auditReadService as never, auditExportService as never, securityOperationsService as never);

    await expect(controller.listLogs({ limit: '25' }, verified())).resolves.toEqual([{ id: 'aud_1' }]);
    await expect(controller.exportLogs({ limit: '25' }, verified('system'))).resolves.toEqual({ rows: [{ id: 'aud_1' }] });
    await expect(controller.listAlerts(verified())).resolves.toEqual([{ id: 'alert_1' }]);
    await expect(controller.integrity(verified())).resolves.toEqual({ valid: true });

    expect(auditReadService.listAuditLogs).toHaveBeenCalledWith({ limit: '25' });
    expect(auditExportService.exportAuditLogs).toHaveBeenCalledWith({ limit: '25' }, expect.objectContaining({ id: 'u1', role: 'system' }));
    expect(securityOperationsService.listSecurityAlerts).toHaveBeenCalledTimes(1);
    expect(auditService.verifyIntegrity).toHaveBeenCalledTimes(1);
  });

  it('serves privacy routes through PrivacyOperationsService with PMCM/system guard', async () => {
    const privacyOperationsService = {
      getInventory: vi.fn(async () => ({ events: [] })),
      listRetentionPolicies: vi.fn(() => [{ surface: 'audit' }]),
      createRequest: vi.fn(async () => ({ id: 'priv_2' })),
      reviewRequest: vi.fn(async () => ({ id: 'priv_2', status: 'approved' })),
      executeRequest: vi.fn(async () => ({ id: 'priv_2', status: 'executed' })),
      listLegalHolds: vi.fn(async () => [{ id: 'hold_1', eventId: 'evt_sample' }]),
      createLegalHold: vi.fn(async () => ({ id: 'hold_1', subjectType: 'client' })),
      releaseLegalHold: vi.fn(async () => ({ id: 'hold_1', releasedAt: '2026-10-05T00:00:00.000Z' })),
    };
    const privacyRequestQueueService = {
      listRequests: vi.fn(async () => ({ items: [{ id: 'priv_1' }], page: 0, limit: 25, total: 1, hasMore: false })),
      assignRequest: vi.fn(async () => ({ id: 'priv_1', assignedTo: 'u1' })),
    };
    const auditService = { audit: vi.fn(async () => ({ id: 'aud_forbidden' })) };
    const securityOperationsService = { recordIntegrityIncident: vi.fn(async () => undefined) };
    const controller = new OpsPrivacyController(privacyOperationsService as any, privacyRequestQueueService as any, auditService as any, securityOperationsService as any);

    await expect(controller.inventory({ eventId: 'evt_sample' }, verified())).resolves.toEqual({ events: [] });
    await expect(controller.retentionPolicies(verified())).resolves.toEqual([{ surface: 'audit' }]);
    const queueQuery = queue({ status: 'open', overdue: 'true' });
    await expect(controller.requests(queueQuery, verified())).resolves.toMatchObject({ items: [{ id: 'priv_1' }], total: 1 });
    expect(privacyRequestQueueService.listRequests).toHaveBeenCalledWith(queueQuery);
    await expect(controller.assignRequest('priv_1', { assignedTo: 'u1' }, verified())).resolves.toEqual({ id: 'priv_1', assignedTo: 'u1' });
    expect(privacyRequestQueueService.assignRequest).toHaveBeenCalledWith(
      'priv_1', { assignedTo: 'u1' }, expect.objectContaining({ id: 'u1', role: 'pmcm-admin', verified: true }),
    );
    await expect(controller.assignRequest('priv_1', { assignedTo: null }, verified('system'))).rejects.toBeInstanceOf(ForbiddenException);
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
    await expect(controller.createLegalHold({
      subjectType: 'client', subjectEmail: 'ana@example.test', reason: 'Preserve records',
    }, verified())).resolves.toEqual({ id: 'hold_1', subjectType: 'client' });
    await expect(controller.legalHolds({ eventId: 'evt_sample' }, verified())).resolves.toEqual([
      { id: 'hold_1', eventId: 'evt_sample' },
    ]);
    await expect(controller.releaseLegalHold('hold_1', { reason: 'Counsel confirmed release' }, verified())).resolves.toEqual({
      id: 'hold_1', releasedAt: '2026-10-05T00:00:00.000Z',
    });
    await expect(controller.createLegalHold({
      subjectType: 'client', subjectEmail: 'ana@example.test', reason: 'Preserve records',
    }, verified('system'))).rejects.toBeInstanceOf(ForbiddenException);

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
    expect(privacyOperationsService.createLegalHold).toHaveBeenCalledWith(
      { subjectType: 'client', subjectEmail: 'ana@example.test', reason: 'Preserve records' },
      expect.objectContaining({ id: 'u1', role: 'pmcm-admin', verified: true }),
    );
    expect(privacyOperationsService.listLegalHolds).toHaveBeenCalledWith({ eventId: 'evt_sample' });
    expect(privacyOperationsService.releaseLegalHold).toHaveBeenCalledWith(
      'hold_1', { reason: 'Counsel confirmed release' }, expect.objectContaining({ id: 'u1', role: 'pmcm-admin', verified: true }),
    );
    expect(auditService.audit).toHaveBeenCalledWith(
      undefined,
      'PMCM Admin',
      '403 forbidden access: privacy legal hold placement',
      expect.objectContaining({ actionType: 'forbidden_access', affectedType: 'scoped_write' }),
    );
  });

  it('records a forbidden audit event before rejecting non-trust actors', async () => {
    const auditService = {
      audit: vi.fn(async () => ({ id: 'aud_forbidden' })),
    };
    const auditReadService = { listAuditLogs: vi.fn(async () => []) };
    const auditExportService = { exportAuditLogs: vi.fn(async () => ({ rows: [] })) };
    const securityOperationsService = { listSecurityAlerts: vi.fn(async () => []) };
    const controller = new OpsAuditController(auditService as never, auditReadService as never, auditExportService as never, securityOperationsService as never);

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
    expect(auditReadService.listAuditLogs).not.toHaveBeenCalled();
  });

  it.each([
    ['requests', OpsPrivacyController.prototype.requests],
    ['assignRequest', OpsPrivacyController.prototype.assignRequest],
    ['reviewRequest', OpsPrivacyController.prototype.reviewRequest],
    ['executeRequest', OpsPrivacyController.prototype.executeRequest],
  ])('refuses an unverified session before the privacy console handler %s runs', (_name, handler) => {
    expect(Reflect.getMetadata('__guards__', handler)).toContain(EventSessionGuard);
  });

  it.each(['coordinator', 'client', 'supplier', 'guest'] as const)(
    'returns 403 and records forbidden access when a %s reaches the privacy console queue, assignment, review, or execution',
    async (role) => {
      const privacyOperationsService = { reviewRequest: vi.fn(), executeRequest: vi.fn() };
      const privacyRequestQueueService = { listRequests: vi.fn(), assignRequest: vi.fn() };
      const auditService = { audit: vi.fn(async () => ({ id: 'aud_forbidden' })) };
      const controller = new OpsPrivacyController(
        privacyOperationsService as any, privacyRequestQueueService as any, auditService as any, { recordIntegrityIncident: vi.fn() } as any,
      );
      const actor = verified(role, 'Outsider');

      await expect(controller.requests(queue({ eventId: 'evt_sample' }), actor)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(controller.assignRequest('priv_1', { assignedTo: 'u1' }, actor)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(controller.reviewRequest('priv_1', { status: 'approved' }, actor)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(controller.executeRequest('priv_1', { correction: { name: 'Ana' } }, actor)).rejects.toBeInstanceOf(ForbiddenException);

      expect(privacyRequestQueueService.listRequests).not.toHaveBeenCalled();
      expect(privacyRequestQueueService.assignRequest).not.toHaveBeenCalled();
      expect(privacyOperationsService.reviewRequest).not.toHaveBeenCalled();
      expect(privacyOperationsService.executeRequest).not.toHaveBeenCalled();
      expect(auditService.audit).toHaveBeenCalledTimes(4);
      expect(auditService.audit).toHaveBeenCalledWith(
        'evt_sample', 'Outsider', '403 forbidden access: privacy requests',
        expect.objectContaining({ actorRole: role, actionType: 'forbidden_access' }),
      );
      expect(auditService.audit).toHaveBeenCalledWith(
        undefined, 'Outsider', '403 forbidden access: privacy request assignment',
        expect.objectContaining({ actorRole: role, actionType: 'forbidden_access' }),
      );
    },
  );
});
