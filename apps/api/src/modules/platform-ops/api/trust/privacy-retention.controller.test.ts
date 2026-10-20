import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsPrivacyRetentionController } from './privacy-retention.controller';

type Role = 'pmcm-admin' | 'coordinator' | 'system' | 'client' | 'supplier' | 'guest';

const verified = (role: Role = 'pmcm-admin') => ({
  id: `${role}-1`,
  actorId: `${role}-1`,
  role,
  actorRole: role,
  email: `${role}@example.test`,
  actorEmail: `${role}@example.test`,
  name: role,
  actorName: role,
  expiresAt: '2099-01-01T00:00:00.000Z',
});

function createController() {
  const retentionService = {
    listPolicies: vi.fn(async () => [{ surface: 'inquiry', category: 'inquiry' }]),
    updatePolicy: vi.fn(async () => ({ category: 'inquiry', enabled: true })),
    listReviewItems: vi.fn(async () => [{ id: 'retention_1' }]),
    executeReviewItem: vi.fn(async () => ({ id: 'retention_1', status: 'executed' })),
    dismissReviewItem: vi.fn(async () => ({ id: 'retention_1', status: 'dismissed' })),
  };
  const auditService = { audit: vi.fn(async () => ({ id: 'aud_forbidden' })) };
  const securityOperationsService = { recordIntegrityIncident: vi.fn(async () => undefined) };
  const controller = new OpsPrivacyRetentionController(retentionService as never, auditService as never, securityOperationsService as never);
  return { controller, retentionService, auditService };
}

const policyChange = { enabled: true, expectedRevision: 1, reason: 'Board approved' };
const reviewer: Role[] = ['coordinator', 'client', 'supplier', 'guest'];

describe('privacy retention controller', () => {
  it('serves the policy list and review queue to the PMCM administrator and system operator', async () => {
    const { controller, retentionService } = createController();

    await expect(controller.retentionPolicies(verified())).resolves.toEqual([{ surface: 'inquiry', category: 'inquiry' }]);
    await expect(controller.retentionReviewItems({ status: 'pending' }, verified('system'))).resolves.toEqual([{ id: 'retention_1' }]);
    await expect(controller.executeRetentionReviewItem('retention_1', { executionNotes: 'ok' }, verified())).resolves.toEqual({ id: 'retention_1', status: 'executed' });
    await expect(controller.dismissRetentionReviewItem('retention_1', { reason: 'kept' }, verified())).resolves.toEqual({ id: 'retention_1', status: 'dismissed' });

    expect(retentionService.executeReviewItem).toHaveBeenCalledWith('retention_1', { executionNotes: 'ok' }, expect.objectContaining({ role: 'pmcm-admin' }));
  });

  it.each(reviewer)('forbids a %s from reading the policy list, the review queue, and any review decision', async (role) => {
    const { controller, retentionService, auditService } = createController();

    await expect(controller.retentionPolicies(verified(role))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.retentionReviewItems({ status: 'pending' }, verified(role))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.executeRetentionReviewItem('retention_1', {}, verified(role))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.dismissRetentionReviewItem('retention_1', { reason: 'x' }, verified(role))).rejects.toBeInstanceOf(ForbiddenException);

    expect(retentionService.executeReviewItem).not.toHaveBeenCalled();
    expect(retentionService.dismissReviewItem).not.toHaveBeenCalled();
    expect(auditService.audit).toHaveBeenCalledWith(undefined, role, expect.stringContaining('403 forbidden access'), expect.objectContaining({ actionType: 'forbidden_access' }));
  });

  it.each([...reviewer, 'system' as Role])('forbids a %s from changing a retention policy, and only the administrator reaches the service', async (role) => {
    const { controller, retentionService } = createController();

    await expect(controller.updateRetentionPolicy('inquiry', policyChange, verified(role))).rejects.toBeInstanceOf(ForbiddenException);
    expect(retentionService.updatePolicy).not.toHaveBeenCalled();

    await controller.updateRetentionPolicy('inquiry', policyChange, verified('pmcm-admin'));
    expect(retentionService.updatePolicy).toHaveBeenCalledWith('inquiry', policyChange, expect.objectContaining({ role: 'pmcm-admin' }));
  });
});
