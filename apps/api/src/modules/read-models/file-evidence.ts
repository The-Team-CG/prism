import type { Prisma } from '@prisma/client';

/** Platform owns stored bytes; lifecycle consumes only confirmed object identity for requirement evidence. */
export async function readStoredConformeEvidence(prisma: Prisma.TransactionClient, eventId: string) {
  return prisma.opsStoredObject.findFirst({
    where: { eventId, usage: 'signed_conforme', lifecycleState: 'stored' },
    orderBy: [{ storedAt: 'desc' }, { id: 'asc' }],
    select: { id: true },
  });
}
