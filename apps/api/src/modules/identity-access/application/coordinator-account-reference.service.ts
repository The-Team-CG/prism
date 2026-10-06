import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { CoordinatorAccountEligibilityReader } from '../contracts/coordinator-account-reference.port';

@Injectable()
export class CoordinatorAccountReferenceService implements CoordinatorAccountEligibilityReader {
  constructor(private readonly prisma: PrismaService) {}

  async isCoordinatorAccountEligible(userId: string, transaction?: PrismTransactionContext) {
    const prisma = transaction?.prisma ?? this.prisma;
    if (transaction) {
      // QUERY_AUDIT_RAW_SQL: serialize assignment eligibility with Identity approval, lockout, and disable changes.
      await transaction.prisma.$queryRaw`SELECT id FROM identity_access.users WHERE id = ${userId} FOR UPDATE`;
    }
    const user = await prisma.opsUser.findUnique({
      where: { id: userId },
      select: { id: true, role: true, approvalStatus: true, permanentLockout: true, lockedUntil: true },
    });
    const temporarilyLocked = Boolean(user?.lockedUntil && user.lockedUntil > new Date());
    return Boolean(
      user &&
      user.role === OpsUserRole.Coordinator &&
      user.approvalStatus === 'approved' &&
      !user.permanentLockout &&
      !temporarilyLocked,
    );
  }
}
