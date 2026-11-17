import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { AccountEmailRelink, AccountEmailRelinker } from '@prism/kernel/shared-kernel';

/** A coordinator's profile is found by account id or email, so its email follows the account. */
@Injectable()
export class OperationsAccountEmailRelinkerService implements AccountEmailRelinker {
  async relinkAccountEmail(input: AccountEmailRelink, tx: Prisma.TransactionClient) {
    if (input.role !== OpsUserRole.Coordinator) return { surfaces: [], touchedRecords: 0 };
    const coordinators = await tx.opsCoordinator.updateMany({
      where: { OR: [{ userId: input.userId }, { email: { equals: input.previousEmail, mode: 'insensitive' } }] },
      data: { email: input.newEmail },
    });
    return { surfaces: ['coordinators'], touchedRecords: coordinators.count };
  }
}
