import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PasswordResetService, portalForAccountRole } from './password-reset.service';
import { AuthSecurityService } from './auth-security.service';
import { OpsUserRole } from '../../../../kernel/event-core';
import type { PasswordResetDeliveryPort } from '../../contracts/password-reset-delivery.port';

const portalUrls = {
  client: 'https://client.example.test',
  supplier: 'https://supplier.example.test',
  event: 'https://event.example.test',
};
const GENERIC_MESSAGE = 'If an account exists for that email, password reset instructions will be sent.';

function fixture(role: string = OpsUserRole.Client, found = true) {
  const user = { id: 'user_1', name: 'Ana', email: 'ana@example.test', role, password: 'stored-hash' as string | null };
  const token = { id: 'prt_1', userId: user.id, tokenHash: '', expiresAt: new Date(Date.now() + 60_000), consumedAt: null };
  const userUpdate = vi.fn().mockResolvedValue(user);
  const prisma = {
    opsUser: { findUnique: vi.fn().mockResolvedValue(found ? user : null) },
    opsPasswordResetRateLimit: {
      upsert: vi.fn().mockResolvedValue({ windowStartedAt: new Date(), requestCount: 1 }),
      update: vi.fn().mockResolvedValue(undefined),
    },
    opsPasswordResetToken: { deleteMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback({
      opsPasswordResetToken: {
        deleteMany: prisma.opsPasswordResetToken.deleteMany,
        create: prisma.opsPasswordResetToken.create,
        findUnique: vi.fn().mockResolvedValue(token),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      opsUser: { update: userUpdate },
    })),
  };
  const authAudit = { write: vi.fn().mockResolvedValue(undefined) };
  const delivery = { deliver: vi.fn<PasswordResetDeliveryPort['deliver']>().mockResolvedValue(undefined) };
  return { prisma, user, token, userUpdate, authAudit, delivery };
}

/** Delivery runs after the response is decided, so tests wait for it through its observable effect. */
async function delivered(delivery: { deliver: { mock: { calls: unknown[][] } } }) {
  await vi.waitFor(() => expect(delivery.deliver.mock.calls.length).toBeGreaterThan(0));
  return delivery.deliver.mock.calls[0][0] as { recipient: string; resetUrl: string };
}

describe('PasswordResetService', () => {
  it('returns the same generic response for known and unknown emails, and never exposes the token', async () => {
    const known = fixture();
    const unknown = fixture(OpsUserRole.Client, false);
    const knownService = new PasswordResetService(known.prisma as never, known.delivery, portalUrls, known.authAudit);
    const unknownService = new PasswordResetService(unknown.prisma as never, unknown.delivery, portalUrls, unknown.authAudit);

    const knownResult = await knownService.request('ANA@EXAMPLE.TEST', '203.0.113.10');
    const unknownResult = await unknownService.request('nobody@example.test', '203.0.113.10');

    expect(knownResult).toEqual({ message: GENERIC_MESSAGE });
    expect(unknownResult).toEqual(knownResult);
    expect(known.authAudit.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'Password reset requested for ana@example.test' }));
    await delivered(known.delivery);
    expect(unknown.delivery.deliver).not.toHaveBeenCalled();
  });

  // A null link means the role has no portal reset page, so the request issues no token and sends nothing.
  it.each([
    [OpsUserRole.Client, 'https://client.example.test/password-reset'],
    [OpsUserRole.Supplier, 'https://supplier.example.test/password-reset'],
    [OpsUserRole.PmcmAdmin, 'https://event.example.test/password-reset'],
    [OpsUserRole.Coordinator, 'https://event.example.test/password-reset'],
    [OpsUserRole.Guest, null],
    [OpsUserRole.System, null],
    [OpsUserRole.Unknown, null],
  ])('reset for the %s role: link %s, same generic response either way', async (role, portalLink) => {
    const { prisma, delivery, authAudit } = fixture(role);
    const service = new PasswordResetService(prisma as never, delivery, portalUrls, authAudit);

    await expect(service.request('ana@example.test', '203.0.113.10')).resolves.toEqual({ message: GENERIC_MESSAGE });

    if (portalLink === null) {
      expect(portalForAccountRole(role as OpsUserRole)).toBeNull();
      expect(prisma.opsPasswordResetToken.create).not.toHaveBeenCalled();
      expect(delivery.deliver).not.toHaveBeenCalled();
      return;
    }
    const { recipient, resetUrl } = await delivered(delivery);
    const link = new URL(resetUrl);
    const token = link.searchParams.get('token');
    expect(recipient).toBe('ana@example.test');
    expect(`${link.origin}${link.pathname}`).toBe(portalLink);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = prisma.opsPasswordResetToken.create.mock.calls[0][0].data;
    expect(stored.tokenHash).toBe(createHash('sha256').update(token!, 'utf8').digest('hex'));
  });

  it('sends no reset link to an invited account without a password, and answers the same way', async () => {
    const { prisma, delivery, authAudit } = fixture(OpsUserRole.Client);
    prisma.opsUser.findUnique.mockResolvedValueOnce({ id: 'user_1', name: 'Ana', email: 'ana@example.test', role: OpsUserRole.Client, password: null });
    const service = new PasswordResetService(prisma as never, delivery, portalUrls, authAudit);

    await expect(service.request('ana@example.test', '203.0.113.10')).resolves.toEqual({ message: GENERIC_MESSAGE });

    expect(prisma.opsPasswordResetToken.create).not.toHaveBeenCalled();
    expect(delivery.deliver).not.toHaveBeenCalled();
  });

  it('keeps the generic response and never logs the reset URL when delivery fails', async () => {
    const { prisma, authAudit } = fixture(OpsUserRole.Client);
    const delivery = { deliver: vi.fn<PasswordResetDeliveryPort['deliver']>().mockRejectedValue(new Error('provider said no')) };
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const service = new PasswordResetService(prisma as never, delivery, portalUrls, authAudit);

    await expect(service.request('ana@example.test', '203.0.113.10')).resolves.toEqual({ message: GENERIC_MESSAGE });

    const { resetUrl } = await delivered(delivery);
    await vi.waitFor(() => expect(authAudit.write).toHaveBeenCalledWith(expect.objectContaining({
      action: 'Password reset delivery failed',
      actionType: 'password_reset_delivery_failed',
      affectedId: 'user_1',
      severity: 'warning',
    })));
    const logged = JSON.stringify([warn.mock.calls, authAudit.write.mock.calls]);
    expect(logged).not.toContain(resetUrl);
    expect(logged).not.toContain(new URL(resetUrl).searchParams.get('token')!);
    expect(logged).not.toContain('provider said no');
    warn.mockRestore();
  });

  it('consumes a valid token atomically and delegates a single session epoch increment', async () => {
    const { prisma, userUpdate, authAudit, delivery } = fixture();
    const service = new PasswordResetService(prisma as never, delivery, portalUrls, authAudit);
    await expect(service.consume('a'.repeat(43), 'a sufficiently long password')).resolves.toEqual({ message: 'Password reset completed. Please sign in again.' });
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        sessionVersion: { increment: 1 },
        failedLoginCount: 0,
        lockoutCount: 0,
        lockedUntil: null,
        permanentLockout: false,
        twoFactorChallengeHash: null,
        twoFactorChallengeExpiresAt: null,
        twoFactorChallengeAttempts: 0,
        twoFactorChallengeConsumedAt: null,
      }),
    }));
    const storedPassword = userUpdate.mock.calls[0][0].data.password;
    expect(await AuthSecurityService.verifyPassword(storedPassword, 'a sufficiently long password')).toBe(true);
    expect(authAudit.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'Password reset consumed' }));
  });

  it('rejects replay or expired tokens without changing the password', async () => {
    const { prisma, authAudit, delivery } = fixture();
    prisma.$transaction.mockImplementationOnce(async (callback: (tx: any) => Promise<unknown>) => callback({
      opsPasswordResetToken: { findUnique: vi.fn().mockResolvedValue({ id: 'prt_1', userId: 'user_1', expiresAt: new Date(Date.now() - 1), consumedAt: null }), updateMany: vi.fn() },
      opsUser: { update: vi.fn() },
    }));
    const service = new PasswordResetService(prisma as never, delivery, portalUrls, authAudit);
    await expect(service.consume('b'.repeat(43), 'a sufficiently long password')).rejects.toBeInstanceOf(BadRequestException);
    expect(authAudit.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'Password reset consumption failed' }));
  });

  it('returns the same response and does not deliver after the durable limit', async () => {
    const { prisma, authAudit, delivery } = fixture();
    prisma.opsPasswordResetRateLimit.upsert.mockResolvedValue({ windowStartedAt: new Date(), requestCount: 4 });
    const service = new PasswordResetService(prisma as never, delivery, portalUrls, authAudit);
    await expect(service.request('ana@example.test', '203.0.113.10')).resolves.toEqual({ message: GENERIC_MESSAGE });
    expect(prisma.opsPasswordResetToken.create).not.toHaveBeenCalled();
    expect(delivery.deliver).not.toHaveBeenCalled();
  });
});
