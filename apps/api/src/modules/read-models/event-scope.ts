import type { Prisma } from '@prisma/client';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';

/** Focused public scope seam for event reads; it carries only trusted ownership facts. */
export async function readEventAccessScope(prisma: Prisma.TransactionClient, eventId: string) {
  return prisma.opsEvent.findUnique({
    where: { id: eventId },
    include: {
      inquiry: { select: { email: true } },
      supplierQuoteRequests: { select: { supplierId: true, supplier: { select: { email: true } } } },
      coordinatorAssignments: {
        where: { status: { notIn: ['cancelled', 'replaced'] }, coordinator: { is: { active: true } } },
        select: { coordinatorId: true, coordinator: { select: { userId: true, email: true } } },
      },
    },
  });
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
  const supplierAssigned = actor.role === 'supplier' && event.supplierQuoteRequests?.some((request) =>
    sameId(actor.supplierId, request.supplierId) || sameEmail(actor.email, request.supplier?.email),
  );
  return {
    actor: actor.role === 'coordinator' ? { ...actor, eventId: coordinatorAssigned ? event.id : undefined } : actor,
    scope: { supplierEventIds: supplierAssigned ? [event.id] : [] },
  };
}
