import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/**
 * Single-use guard shared by addendum issuance and scope change approval. The conditional update only succeeds
 * while the approval is unconsumed for this event, so a concurrent second use loses the row race and sees count 0.
 * Callers run it inside their own transaction so a later failure rolls the consumption back.
 */
export async function consumeApprovedFreezeException(tx: Prisma.TransactionClient, eventId: string, exceptionId: string, consumption: { consumedByDecisionId?: string } = {}) {
  const consumed = await tx.opsEventFreezeException.updateMany({
    where: { id: exceptionId, eventId, status: 'approved', consumedAt: null },
    data: { consumedAt: new Date(), ...consumption },
  });
  if (consumed.count !== 1) throw new BadRequestException('Freeze exception is not an unused approval for this event');
  return { id: exceptionId };
}
