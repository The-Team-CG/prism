import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { AccountEmailRelink, AccountEmailRelinker } from '@prism/kernel/shared-kernel';

/**
 * A supplier account finds its supplier record by email, and message threads deliver to each member's email, so both
 * follow the account. Threads match by account id, never by the old address.
 */
@Injectable()
export class CommercialAccountEmailRelinkerService implements AccountEmailRelinker {
  async relinkAccountEmail(input: AccountEmailRelink, tx: Prisma.TransactionClient) {
    const participants = await tx.opsCommunicationParticipant.updateMany({ where: { actorId: input.userId }, data: { actorEmail: input.newEmail } });
    if (input.role !== OpsUserRole.Supplier) return { surfaces: ['communication_participants'], touchedRecords: participants.count };
    const suppliers = await tx.opsSupplier.updateMany({ where: { email: { equals: input.previousEmail, mode: 'insensitive' } }, data: { email: input.newEmail } });
    return { surfaces: ['communication_participants', 'suppliers'], touchedRecords: participants.count + suppliers.count };
  }
}
