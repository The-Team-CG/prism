import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { EventSessionGuard } from '@prism/kernel/event-session';
import { submitOwnPrivacyRequestSchema } from '@prism/types';
import { OpsOwnPrivacyRequestController } from './own-privacy-request.controller';

type Role = 'pmcm-admin' | 'system' | 'client' | 'coordinator' | 'supplier' | 'guest';

const verified = (role: Role, name = 'Requester', email = 'requester@example.test') => ({
  id: 'usr_requester', actorId: 'usr_requester', role, actorRole: role, email, actorEmail: email, name, actorName: name,
  expiresAt: '2099-01-01T00:00:00.000Z',
});

function fixture() {
  const ownPrivacyRequestService = {
    submit: vi.fn(async () => ({ id: 'priv_1', type: 'access', status: 'submitted' })),
    listOwn: vi.fn(async () => [{ id: 'priv_1' }]),
  };
  const auditService = { audit: vi.fn(async () => undefined) };
  const securityOperationsService = { recordIntegrityIncident: vi.fn(async () => undefined) };
  const controller = new OpsOwnPrivacyRequestController(ownPrivacyRequestService as never, auditService as never, securityOperationsService as never);
  return { controller, ownPrivacyRequestService, auditService };
}

describe('own privacy request controller', () => {
  it('requires the verified session on both self-service routes', () => {
    const { controller } = fixture();
    expect(Reflect.getMetadata('__guards__', controller.listMine)).toContain(EventSessionGuard);
    expect(Reflect.getMetadata('__guards__', controller.submitMine)).toContain(EventSessionGuard);
  });

  it('lets a client or supplier file and list only through the verified actor', async () => {
    const { controller, ownPrivacyRequestService } = fixture();

    await expect(controller.submitMine({ requestType: 'access' }, verified('client', 'Ana', 'ana@example.test'))).resolves.toMatchObject({ id: 'priv_1' });
    await expect(controller.listMine(verified('supplier', 'Supplier Co', 'ops@supplier.test'))).resolves.toEqual([{ id: 'priv_1' }]);

    expect(ownPrivacyRequestService.submit).toHaveBeenCalledWith(
      { requestType: 'access' },
      expect.objectContaining({ id: 'usr_requester', role: 'client', email: 'ana@example.test', verified: true }),
    );
    expect(ownPrivacyRequestService.listOwn).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'supplier', email: 'ops@supplier.test', verified: true }),
    );
  });

  it.each(['pmcm-admin', 'system', 'coordinator', 'guest'] as const)(
    'refuses %s on both routes and audits the attempt without filing anything',
    async (role) => {
      const { controller, ownPrivacyRequestService, auditService } = fixture();
      const actor = verified(role, 'Outsider');

      await expect(controller.submitMine({ requestType: 'access' }, actor)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(controller.listMine(actor)).rejects.toBeInstanceOf(ForbiddenException);

      expect(ownPrivacyRequestService.submit).not.toHaveBeenCalled();
      expect(ownPrivacyRequestService.listOwn).not.toHaveBeenCalled();
      expect(auditService.audit).toHaveBeenCalledTimes(2);
      expect(auditService.audit).toHaveBeenCalledWith(
        undefined, 'Outsider', '403 forbidden access: own privacy requests',
        expect.objectContaining({ actorRole: role, actionType: 'forbidden_access' }),
      );
    },
  );

  it('requires details for a correction and allows an access request without them', () => {
    expect(submitOwnPrivacyRequestSchema.safeParse({ requestType: 'correction' }).success).toBe(false);
    expect(submitOwnPrivacyRequestSchema.safeParse({ requestType: 'correction', details: '   ' }).success).toBe(false);
    expect(submitOwnPrivacyRequestSchema.safeParse({ requestType: 'correction', details: 'Fix my company name' }).success).toBe(true);
    expect(submitOwnPrivacyRequestSchema.safeParse({ requestType: 'access' }).success).toBe(true);
    expect(submitOwnPrivacyRequestSchema.safeParse({ requestType: 'erasure' }).success).toBe(false);
  });
});
