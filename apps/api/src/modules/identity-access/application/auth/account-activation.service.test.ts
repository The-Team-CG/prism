import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AccountActivationService } from './account-activation.service';
import { AuthSecurityService } from './auth-security.service';

const SAMPLE_TOKEN = 'a'.repeat(43);
const SAMPLE_PASSWORD = 'a sufficiently long password';
const INVALID = 'Invalid or expired activation link';
const future = () => new Date(Date.now() + 60_000);

function fixture({ invitation, userUpdated = true, role = 'client' }: {
  invitation: Record<string, unknown> | null;
  userUpdated?: boolean;
  role?: string;
}) {
  const user = { id: 'usr_ana', name: 'Ana Reyes', email: 'ana@example.test', role, organization: 'Ana Events' };
  const tx = {
    opsAccountInvitation: {
      findUnique: vi.fn(async () => invitation),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    opsUser: {
      updateMany: vi.fn(async () => ({ count: userUpdated ? 1 : 0 })),
      findUniqueOrThrow: vi.fn(async () => user),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const authAudit = { write: vi.fn(async () => undefined) };
  const service = new AccountActivationService(prisma as never, authAudit);
  return { service, tx, authAudit };
}

const live = { id: 'inv_1', userId: 'usr_ana', consumedAt: null, revokedAt: null, expiresAt: future() };

describe('AccountActivationService', () => {
  it('sets the password, approves the account, starts a new session epoch and consumes the token once', async () => {
    const { service, tx, authAudit } = fixture({ invitation: live, role: 'supplier' });

    await expect(service.activate(SAMPLE_TOKEN, SAMPLE_PASSWORD)).resolves.toEqual({ message: 'Password set. Sign in to continue.' });

    expect(tx.opsAccountInvitation.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv_1', consumedAt: null, revokedAt: null, expiresAt: { gt: expect.any(Date) } },
      data: { consumedAt: expect.any(Date) },
    });
    const [update] = tx.opsUser.updateMany.mock.calls[0] as unknown as [{ where: Record<string, unknown>; data: Record<string, unknown> }];
    expect(update.where).toEqual({ id: 'usr_ana', approvalStatus: 'invited' });
    expect(update.data).toMatchObject({ approvalStatus: 'approved', sessionVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null });
    expect(await AuthSecurityService.verifyPassword(update.data.password as string, SAMPLE_PASSWORD)).toBe(true);
    expect(authAudit.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'Account activated for ana@example.test' }));
  });

  it.each([
    ['an unknown token', null],
    ['an already used token', { ...live, consumedAt: new Date() }],
    ['a revoked token', { ...live, revokedAt: new Date() }],
    ['an expired token', { ...live, expiresAt: new Date(Date.now() - 1) }],
  ])('rejects %s with the same generic message and touches nothing', async (_label, invitation) => {
    const { service, tx, authAudit } = fixture({ invitation });

    await expect(service.activate(SAMPLE_TOKEN, SAMPLE_PASSWORD)).rejects.toThrow(BadRequestException);
    await expect(service.activate(SAMPLE_TOKEN, SAMPLE_PASSWORD)).rejects.toThrow(INVALID);

    expect(tx.opsAccountInvitation.updateMany).not.toHaveBeenCalled();
    expect(tx.opsUser.updateMany).not.toHaveBeenCalled();
    expect(authAudit.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'Account activation failed' }));
  });

  it('rejects a live token whose account is no longer waiting for activation, so the token is not consumed', async () => {
    const { service, tx } = fixture({ invitation: live, userUpdated: false });

    await expect(service.activate(SAMPLE_TOKEN, SAMPLE_PASSWORD)).rejects.toThrow(INVALID);

    expect(tx.opsUser.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
