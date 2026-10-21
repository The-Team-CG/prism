import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { CoordinatorAccountReferenceService } from './coordinator-account-reference.service';

describe('CoordinatorAccountReferenceService', () => {
  it('accepts only approved coordinator accounts without an active lockout', async () => {
    const findUnique = vi.fn(async () => ({
      id: 'u_coord',
      role: OpsUserRole.Coordinator,
      approvalStatus: 'approved',
      permanentLockout: false,
      lockedUntil: null,
    }));
    const service = new CoordinatorAccountReferenceService({ opsUser: { findUnique } } as never);

    await expect(service.isCoordinatorAccountEligible('u_coord')).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'u_coord' },
      select: { id: true, role: true, approvalStatus: true, permanentLockout: true, lockedUntil: true },
    });
  });

  it.each([
    ['pending', false, null],
    ['approved', true, null],
    ['approved', false, new Date(Date.now() + 60_000)],
  ])('rejects approval or lockout state %s / %s / %s', async (approvalStatus, permanentLockout, lockedUntil) => {
    const findUnique = vi.fn(async () => ({
      id: 'u_coord',
      role: OpsUserRole.Coordinator,
      approvalStatus,
      permanentLockout,
      lockedUntil,
    }));
    const service = new CoordinatorAccountReferenceService({ opsUser: { findUnique } } as never);

    await expect(service.isCoordinatorAccountEligible('u_coord')).resolves.toBe(false);
  });

  it('rejects a user whose current identity role is no longer coordinator', async () => {
    const service = new CoordinatorAccountReferenceService({
      opsUser: {
        findUnique: vi.fn(async () => ({
          id: 'u_coord',
          role: OpsUserRole.Client,
          approvalStatus: 'approved',
          permanentLockout: false,
          lockedUntil: null,
        })),
      },
    } as never);

    await expect(service.isCoordinatorAccountEligible('u_coord')).resolves.toBe(false);
  });

  it('locks the account in the caller transaction before reading current eligibility', async () => {
    const readOrder: string[] = [];
    const queryRaw = vi.fn(async () => {
      readOrder.push('lock');
      return [{ id: 'u_coord' }];
    });
    const findUnique = vi.fn(async () => {
      readOrder.push('read');
      return {
        id: 'u_coord',
        role: OpsUserRole.Coordinator,
        approvalStatus: 'approved',
        permanentLockout: false,
        lockedUntil: null,
      };
    });
    const tx = { $queryRaw: queryRaw, opsUser: { findUnique } };
    const service = new CoordinatorAccountReferenceService({} as never);

    await expect(service.isCoordinatorAccountEligible('u_coord', { prisma: tx as never, correlationId: 'assignment' })).resolves.toBe(true);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(readOrder).toEqual(['lock', 'read']);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'u_coord' },
      select: { id: true, role: true, approvalStatus: true, permanentLockout: true, lockedUntil: true },
    });
  });
});
