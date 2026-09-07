import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PasswordResetService } from './password-reset.service';

function fixture() {
  const user = { id: 'user_1', email: 'ana@example.test' };
  const token = { id: 'prt_1', userId: user.id, tokenHash: '', expiresAt: new Date(Date.now() + 60_000), consumedAt: null };
  const userUpdate = vi.fn().mockResolvedValue(user);
  const prisma = {
    opsUser: { findUnique: vi.fn().mockResolvedValue(user) },
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
  return { prisma, user, token, userUpdate };
}

describe('PasswordResetService', () => {
  it('returns an enumeration-safe response and never exposes the token', async () => {
    const { prisma, userUpdate } = fixture();
    const delivery = { deliver: vi.fn().mockResolvedValue(undefined) };
    const service = new PasswordResetService(prisma as never, delivery);
    const result = await service.request('ANA@EXAMPLE.TEST');
    expect(result.message).not.toContain('token');
    expect(result.deliveryAvailable).toBe(false);
    expect(delivery.deliver).not.toHaveBeenCalled();
  });

  it('consumes a valid token atomically and delegates a single session epoch increment', async () => {
    const { prisma, userUpdate } = fixture();
    const service = new PasswordResetService(prisma as never);
    await expect(service.consume('a'.repeat(43), 'a sufficiently long password')).resolves.toEqual({ message: 'Password reset completed. Please sign in again.' });
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sessionVersion: { increment: 1 } }),
    }));
  });

  it('rejects replay or expired tokens without changing the password', async () => {
    const { prisma } = fixture();
    prisma.$transaction.mockImplementationOnce(async (callback: (tx: any) => Promise<unknown>) => callback({
      opsPasswordResetToken: { findUnique: vi.fn().mockResolvedValue({ id: 'prt_1', userId: 'user_1', expiresAt: new Date(Date.now() - 1), consumedAt: null }), updateMany: vi.fn() },
      opsUser: { update: vi.fn() },
    }));
    const service = new PasswordResetService(prisma as never);
    await expect(service.consume('b'.repeat(43), 'a sufficiently long password')).rejects.toBeInstanceOf(BadRequestException);
  });
});
