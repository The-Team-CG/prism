import type { Prisma } from '@prisma/client';

/** Focused public scope seam for event reads; it carries only trusted ownership facts. */
export async function readEventAccessScope(prisma: Prisma.TransactionClient, eventId: string) {
  const event = await prisma.opsEvent.findUnique({
    where: { id: eventId },
    include: {
      inquiry: { select: { email: true } },
    },
  });
  if (!event) return null;
  const [supplierQuoteRequests, coordinatorAssignments] = await Promise.all([
    prisma.opsSupplierQuoteRequest.findMany({
      where: { eventId },
      select: { supplierId: true, status: true, supplier: { select: { email: true } } },
    }),
    prisma.opsCoordinatorAssignment.findMany({
      where: {
        eventId,
        status: { notIn: ['cancelled', 'replaced'] },
        coordinator: { is: { active: true } },
      },
      select: { coordinatorId: true, coordinator: { select: { userId: true, email: true } } },
    }),
  ]);
  return {
    ...event,
    supplierQuoteRequests,
    coordinatorAssignments,
  };
}

/** Public game lobby scope. Only event display name and archive state cross into event-games. */
export async function readEventGameLobbyScope(prisma: Prisma.TransactionClient, eventId: string) {
  const event = await prisma.opsEvent.findUnique({
    where: { id: eventId },
    select: { id: true, eventName: true, archived: true, actualEndedAt: true, status: true },
  });
  return event ? { ...event, closed: event.archived || Boolean(event.actualEndedAt) || ['closed', 'archived'].includes(event.status.toLowerCase()) } : null;
}

export { readEventGameWriteState } from './application/queries/event-game-lifecycle.queries';

/** Event lifecycle facts required to enforce post-event game-response retention. */
export async function readEventGameResponseRetentionScope(prisma: Prisma.TransactionClient, eventId: string) {
  const event = await prisma.opsEvent.findUnique({
    where: { id: eventId },
    select: { id: true, archivedAt: true, archived: true, actualEndedAt: true, status: true },
  });
  if (!event) return null;
  return {
    eventId: event.id,
    archivedAt: event.archivedAt,
    closed: event.archived || Boolean(event.actualEndedAt) || ['closed', 'archived'].includes(event.status.toLowerCase()),
  };
}

