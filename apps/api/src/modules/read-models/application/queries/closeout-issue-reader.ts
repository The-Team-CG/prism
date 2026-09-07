import type { Prisma } from '@prisma/client';

/** Read-only composition usable inside the archive command's transaction. */
export function readUnresolvedCloseoutIssues(prisma: Pick<Prisma.TransactionClient, 'opsUrgentIssue'>, eventId: string) {
  return prisma.opsUrgentIssue.findMany({
    where: { eventId, status: { not: 'resolved' } },
    select: { id: true, severity: true, status: true },
  });
}
