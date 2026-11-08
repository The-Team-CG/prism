import type { ResolvedEventOpsActor } from './services/event-access-policy.service';

/**
 * Persisted event facts the shared scope resolver reads. Callers load them from
 * the event access scope query; the resolver never trusts role or query labels.
 */
export type EventScopeFacts = {
  id: string;
  coordinatorAssignments: ReadonlyArray<{
    coordinatorId: string | null;
    coordinator: { userId: string | null; email: string | null } | null;
  }>;
  supplierQuoteRequests: ReadonlyArray<{
    supplierId: string | null;
    status: string;
    supplier: { email: string | null } | null;
  }>;
};

function sameId(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left && right && left === right);
}

function sameEmail(left: string | null | undefined, right: string | null | undefined) {
  const email = left?.trim().toLowerCase();
  return Boolean(email && email === right?.trim().toLowerCase());
}

/**
 * The one event-scope resolver shared by file access, matrix reads, and event-games.
 * A coordinator gains event scope only through a current assignment; a supplier is
 * matched to its quote request. `supplierBookingSelected` is true only when the matched
 * request is `selected`, which file access requires (`supplierEventIds` is unchanged).
 */
export function scopeActorToEvent(actor: ResolvedEventOpsActor, event: EventScopeFacts & { id: string }) {
  const coordinatorAssigned = actor.role === 'coordinator' && event.coordinatorAssignments.some((assignment) =>
    sameId(actor.coordinatorId, assignment.coordinatorId) ||
    sameId(actor.id, assignment.coordinator?.userId) ||
    sameEmail(actor.email, assignment.coordinator?.email),
  );
  const supplierMatches = actor.role === 'supplier'
    ? event.supplierQuoteRequests.filter((request) => sameId(actor.supplierId, request.supplierId) || sameEmail(actor.email, request.supplier?.email))
    : [];
  const supplierAssignment = supplierMatches[0];
  return {
    actor: actor.role === 'coordinator' ? { ...actor, eventId: coordinatorAssigned ? event.id : undefined }
      : actor.role === 'supplier' ? { ...actor, supplierId: supplierAssignment?.supplierId ?? undefined } : actor,
    scope: { supplierEventIds: supplierAssignment ? [event.id] : [] },
    supplierBookingSelected: supplierMatches.some((request) => request.status === 'selected'),
  };
}

/**
 * Event gate for file reads and file-requirement references. A supplier passes only while
 * its booking on this event is `selected` (D2); every other role uses the shared scope.
 */
export function resolveFileEventScope(actor: ResolvedEventOpsActor, event: EventScopeFacts & { id: string }) {
  const resolved = scopeActorToEvent(actor, event);
  return { actor: resolved.actor, scope: { supplierEventIds: resolved.supplierBookingSelected ? [event.id] : [] } };
}
