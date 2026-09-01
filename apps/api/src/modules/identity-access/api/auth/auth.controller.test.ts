import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsAuthController } from './auth.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsAuthController', () => {
  it('keeps the public auth route base stable under identity-ops ownership', () => {
    expect(controllerPath(OpsAuthController)).toBe('auth');
  });

  it('serves auth operations through AuthOperationsService', async () => {
    const authOperationsService = {
      login: vi.fn(async () => ({ id: 'user_pmcm' })),
      requestApproval: vi.fn(async () => ({ id: 'approval_user' })),
      listApprovalRequests: vi.fn(async () => [{ id: 'approval_user' }]),
      listLoginHistory: vi.fn(async () => [{ id: 'login_1' }]),
      approveApprovalRequest: vi.fn(async () => ({ status: 'approved' })),
      declineApprovalRequest: vi.fn(async () => ({ status: 'declined' })),
    };
    const controller = new OpsAuthController(authOperationsService as any);

    await expect(controller.login({ email: 'maxine@pmcm.test', password: 'secret' })).resolves.toEqual({ id: 'user_pmcm' });
    await expect(controller.requestApproval({ email: 'client@example.test', privacyConsentAccepted: true })).resolves.toEqual({ id: 'approval_user' });
    await expect(controller.listApprovalRequests()).resolves.toEqual([{ id: 'approval_user' }]);
    await expect(controller.listLoginHistory('user_pmcm')).resolves.toEqual([{ id: 'login_1' }]);
    await expect(controller.approveApprovalRequest('approval_user')).resolves.toEqual({ status: 'approved' });
    await expect(controller.declineApprovalRequest('approval_user')).resolves.toEqual({ status: 'declined' });

    expect(authOperationsService.login).toHaveBeenCalledWith('maxine@pmcm.test', 'secret');
    expect(authOperationsService.requestApproval).toHaveBeenCalledWith({
      email: 'client@example.test',
      privacyConsentAccepted: true,
    });
    expect(authOperationsService.listLoginHistory).toHaveBeenCalledWith('user_pmcm');
    expect(authOperationsService.approveApprovalRequest).toHaveBeenCalledWith('approval_user');
    expect(authOperationsService.declineApprovalRequest).toHaveBeenCalledWith('approval_user');
  });
});