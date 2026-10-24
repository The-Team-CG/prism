import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PasswordResetService } from './password-reset.service';
import { AuthSecurityService } from './auth-security.service';

function fixture() {
  const user = { id: 'user_1', email: 'ana@example.test' };
  const token = { id: 'prt_1', userId: user.id, tokenHash: '', expiresAt: new Date(Date.now() + 60_000), consumedAt: null };
  const userUpdate = vi.fn().mockResolvedValue(user);
  const prisma = {
    opsUser: { findUnique: vi.fn().mockResolvedValue(user) },
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
  return { prisma, user, token, userUpdate, authAudit };
}

describe('PasswordResetService', () => {
  it('returns an enumeration-safe response and never exposes the token', async () => {
    const { prisma, userUpdate, authAudit } = fixture();
    const delivery = { deliver: vi.fn().mockResolvedValue(undefined) };
    const service = new PasswordResetService(prisma as never, delivery, authAudit);
    const result = await service.request('ANA@EXAMPLE.TEST', '203.0.113.10');
    expect(result).toEqual({ message: expect.not.stringContaining('token'), deliveryAvailable: false });
    expect(delivery.deliver).not.toHaveBeenCalled();
    expect(authAudit.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'Password reset requested for ana@example.test' }));
  });

  it('consumes a valid token atomically and delegates a single session epoch increment', async () => {
    const { prisma, userUpdate, authAudit } = fixture();
    const service = new PasswordResetService(prisma as never, undefined, authAudit);
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
    const { prisma, authAudit } = fixture();
    prisma.$transaction.mockImplementationOnce(async (callback: (tx: any) => Promise<unknown>) => callback({
      opsPasswordResetToken: { findUnique: vi.fn().mockResolvedValue({ id: 'prt_1', userId: 'user_1', expiresAt: new Date(Date.now() - 1), consumedAt: null }), updateMany: vi.fn() },
      opsUser: { update: vi.fn() },
    }));
    const service = new PasswordResetService(prisma as never, undefined, authAudit);
    await expect(service.consume('b'.repeat(43), 'a sufficiently long password')).rejects.toBeInstanceOf(BadRequestException);
    expect(authAudit.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'Password reset consumption failed' }));
  });

  it('keeps an existing valid token when issuing a fresh reset request', async () => {
    const { prisma, authAudit } = fixture();
    const service = new PasswordResetService(prisma as never, undefined, authAudit);
    await service.request('ana@example.test', '203.0.113.10');
    expect(prisma.opsPasswordResetToken.deleteMany).not.toHaveBeenCalled();
    expect(prisma.opsPasswordResetToken.create).toHaveBeenCalledTimes(1);
  });

  it('returns the same response and does not deliver after the durable limit', async () => {
    const { prisma, authAudit } = fixture();
    prisma.opsPasswordResetRateLimit.upsert.mockResolvedValue({ windowStartedAt: new Date(), requestCount: 4 });
    const delivery = { deliver: vi.fn().mockResolvedValue(undefined) };
    const service = new PasswordResetService(prisma as never, delivery, authAudit);
    await expect(service.request('ana@example.test', '203.0.113.10')).resolves.toEqual({ message: 'If an account exists for that email, password reset instructions will be sent.', deliveryAvailable: false });
    expect(delivery.deliver).not.toHaveBeenCalled();
  });
});
