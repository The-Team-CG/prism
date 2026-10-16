import type { Prisma } from '@prisma/client';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';

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
      select: { supplierId: true, supplier: { select: { email: true } } },
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

/**
 * Cross-context read. Owner: event-lifecycle (OpsInquiry.conformeSignedAt, written by
 * InquiriesService.uploadConforme). Reason: floorplan must not open an official draft before the
 * client signs the conforme (EP-05-S01 AC1). Allowed fields: conformeSignedAt only. Transition
 * intent: collapses into an event-lifecycle contract if conforme state becomes a published
 * capability; floorplan owns the rule, this returns a fact only.
 *
 * Deliberately separate from readEventAccessScope rather than widening it: that seam carries only
 * trusted ownership facts and has a second consumer (file-requirements-matrix.service.ts).
 */
export async function readEventOcularVisitState(prisma: Prisma.TransactionClient, eventId: string) {
  const request = await prisma.opsOcularVisitRequest.findUnique({
    where: { eventId },
    select: { status: true },
  });
  return request?.status ?? null;
}

export async function readEventConformeState(prisma: Prisma.TransactionClient, eventId: string) {
  const event = await prisma.opsEvent.findUnique({
    where: { id: eventId },
    select: { inquiry: { select: { conformeSignedAt: true } } },
  });
  if (!event) return null;
  return { conformeSignedAt: event.inquiry?.conformeSignedAt ?? null };
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

type ScopedEvent = NonNullable<Awaited<ReturnType<typeof readEventAccessScope>>>;

function sameId(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left && right && left === right);
}

function sameEmail(left: string | null | undefined, right: string | null | undefined) {
  const email = left?.trim().toLowerCase();
  return Boolean(email && email === right?.trim().toLowerCase());
}

/** Derive assignment scope only from persisted identity relations, never role/query labels. */
export function scopeActorToEvent(actor: ResolvedEventOpsActor, event: ScopedEvent) {
  const coordinatorAssigned = actor.role === 'coordinator' && event.coordinatorAssignments?.some((assignment) =>
    sameId(actor.coordinatorId, assignment.coordinatorId) ||
    sameId(actor.id, assignment.coordinator?.userId) ||
    sameEmail(actor.email, assignment.coordinator?.email),
  );
  const supplierAssignment = actor.role === 'supplier' ? event.supplierQuoteRequests?.find((request) =>
    sameId(actor.supplierId, request.supplierId) || sameEmail(actor.email, request.supplier?.email),
  ) : undefined;
  return {
    actor: actor.role === 'coordinator' ? { ...actor, eventId: coordinatorAssigned ? event.id : undefined }
      : actor.role === 'supplier' ? { ...actor, supplierId: supplierAssignment?.supplierId ?? undefined } : actor,
    scope: { supplierEventIds: supplierAssignment ? [event.id] : [] },
  };
}
