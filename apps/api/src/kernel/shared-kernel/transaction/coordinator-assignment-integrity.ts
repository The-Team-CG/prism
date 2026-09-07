import type { Prisma } from '@prisma/client';

/**
 * Serialize every writer that can create an assignment for one coordinator
 * on one canonical UTC event day. The lock is released automatically at tx end.
 */
export async function lockCoordinatorAssignmentDay(
  prisma: Prisma.TransactionClient,
  coordinatorId: string,
  eventDate: Date,
) {
  const day = eventDate.toISOString().slice(0, 10);
  await prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`coordinator-assignment:${coordinatorId}:${day}`}, 0))`;
}
