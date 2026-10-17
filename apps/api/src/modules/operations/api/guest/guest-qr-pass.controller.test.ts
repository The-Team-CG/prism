import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismVerifiedEventActor } from '@prism/types';
import { OpsGuestQrPassController } from './guest-qr-pass.controller';

const verifiedActor: PrismVerifiedEventActor = {
  id: 'user_pmcm',
  actorId: 'user_pmcm',
  role: 'pmcm-admin',
  actorRole: 'pmcm-admin',
  actorName: 'PMCM Admin',
  actorEmail: 'admin@example.test',
  name: 'PMCM Admin',
  email: 'admin@example.test',
  expiresAt: '2026-10-18T00:00:00.000Z',
};
const passStatus = {
  id: 'pass_1',
  eventId: 'evt_1',
  rosterEntryId: 'gre_1',
  status: 'active',
  deliveryStatus: 'queued',
  issuedAt: '2026-10-17T00:00:00.000Z',
  revokedAt: null,
};

function createController(role = 'pmcm-admin', demoEnabled = true) {
  const actor = { id: 'user_pmcm', name: 'PMCM Admin', email: 'admin@example.test', role };
  const accessPolicy = {
    resolveActor: vi.fn(() => actor),
    requireActorRole: vi.fn(async (resolved: { role: string }, allowed: readonly string[]) => {
      if (!allowed.includes(resolved.role)) throw new ForbiddenException('Actor role is not permitted');
    }),
  };
  const demoPolicy = { isEnabledForEvent: vi.fn(() => demoEnabled) };
  const passService = {
    listForRoster: vi.fn(async () => ({ available: demoEnabled, passes: demoEnabled ? [passStatus] : [] })),
    get: vi.fn(async () => passStatus),
    issue: vi.fn(async () => ({ pass: passStatus, qrValue: 'https://guest.prism.test/qr-check-in?accessCode=EVT-1234#opaque-secret-token' })),
    retry: vi.fn(async () => passStatus),
    reissue: vi.fn(async () => ({ pass: passStatus, qrValue: 'https://guest.prism.test/qr-check-in?accessCode=EVT-1234#opaque-secret-token' })),
    revoke: vi.fn(async () => ({ ...passStatus, status: 'revoked', deliveryStatus: 'revoked' })),
  };
  const controller = new OpsGuestQrPassController(accessPolicy as never, demoPolicy as never, passService as never);
  return { accessPolicy, actor, controller, demoPolicy, passService };
}

describe('OpsGuestQrPassController', () => {
  it('returns server-derived availability with statuses scoped to submitted roster IDs', async () => {
    const harness = createController('pmcm-admin', false);

    const result = await harness.controller.listForRoster('evt_1', { rosterEntryIds: ['gre_1'] }, verifiedActor);

    expect(result).toEqual({ available: false, passes: [] });
    expect(harness.demoPolicy.isEnabledForEvent).not.toHaveBeenCalled();
    expect(harness.passService.listForRoster).toHaveBeenCalledWith('evt_1', ['gre_1'], harness.actor);
  });

  it.each(['listForRoster', 'get', 'issue', 'retry', 'reissue', 'revoke'] as const)(
    'requires a verified PMCM Admin or System role before dispatching %s',
    async (command) => {
      const harness = createController('coordinator');
      const request = command === 'listForRoster' ? harness.controller.listForRoster('evt_1', { rosterEntryIds: ['gre_1'] }, verifiedActor)
        : command === 'get' ? harness.controller.get('evt_1', 'pass_1', verifiedActor)
          : command === 'issue' ? harness.controller.issue('evt_1', 'gre_1', verifiedActor)
            : command === 'retry' ? harness.controller.retry('evt_1', 'pass_1', verifiedActor)
              : command === 'reissue' ? harness.controller.reissue('evt_1', 'pass_1', verifiedActor)
                : harness.controller.revoke('evt_1', 'pass_1', verifiedActor);

      await expect(request).rejects.toBeInstanceOf(ForbiddenException);
      expect(harness.passService[command]).not.toHaveBeenCalled();
      expect(harness.accessPolicy.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    },
  );

  it('returns unavailable from the server without loading pass rows when demo policy is disabled', async () => {
    const harness = createController('pmcm-admin', false);

    await expect(harness.controller.listForRoster('evt_1', { rosterEntryIds: ['gre_1'] }, verifiedActor as never))
      .resolves.toEqual({ available: false, passes: [] });
    expect(harness.demoPolicy.isEnabledForEvent).not.toHaveBeenCalled();
    expect(harness.passService.listForRoster).toHaveBeenCalledWith('evt_1', ['gre_1'], harness.actor);
  });

  it('returns scoped status fields without QR, email, or token data', async () => {
    const harness = createController();

    const status = await harness.controller.listForRoster('evt_1', { rosterEntryIds: ['gre_1'] }, verifiedActor as never);

    expect(status).toEqual({ available: true, passes: [passStatus] });
    expect(JSON.stringify(status)).not.toMatch(/qrValue|token|email|recipient|message/i);
  });

  it('keeps generic pass errors free of token and recipient data', async () => {
    const harness = createController();
    harness.passService.issue.mockRejectedValueOnce(new ServiceUnavailableException('Guest QR passes are unavailable'));

    let error: unknown;
    try {
      await harness.controller.issue('evt_1', 'gre_1', verifiedActor as never);
    } catch (failure) {
      error = failure;
    }

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(JSON.stringify((error as ServiceUnavailableException).getResponse())).not.toMatch(/opaque-secret-token|admin@example.test|guest@example.test|qrValue|recipient/i);
  });

  it('returns QR data only from an immediate issue or reissue command', async () => {
    const harness = createController();

    const issued = await harness.controller.issue('evt_1', 'gre_1', verifiedActor as never);
    const reissued = await harness.controller.reissue('evt_1', 'pass_1', verifiedActor as never);

    for (const result of [issued, reissued]) {
      const qrUrl = new URL(result.qrValue);
      expect(qrUrl.pathname).toBe('/qr-check-in');
      expect(qrUrl.searchParams.get('accessCode')).toBe('EVT-1234');
      expect(qrUrl.hash).toBe('#opaque-secret-token');
    }
    expect(await harness.controller.get('evt_1', 'pass_1', verifiedActor as never)).not.toHaveProperty('qrValue');
    expect(await harness.controller.retry('evt_1', 'pass_1', verifiedActor as never)).not.toHaveProperty('qrValue');
    expect(await harness.controller.revoke('evt_1', 'pass_1', verifiedActor as never)).not.toHaveProperty('qrValue');
  });

  it('uses the verified actor and event path instead of request-supplied authority', async () => {
    const harness = createController('system');

    await harness.controller.retry('evt_1', 'pass_1', verifiedActor as never);

    expect(harness.passService.retry).toHaveBeenCalledWith('evt_1', 'pass_1', harness.actor);
  });
});
