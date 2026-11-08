import { describe, expect, it } from 'vitest';
import { resolveFileEventScope, scopeActorToEvent } from './event-scope';
import type { ResolvedEventOpsActor } from './services/event-access-policy.service';

const event = {
  id: 'evt_1',
  coordinatorAssignments: [{ coordinatorId: 'coord_1', coordinator: { userId: 'user_coord', email: 'coord@example.test' } }],
  supplierQuoteRequests: [
    { supplierId: 'sup_1', status: 'selected', supplier: { email: 'sup1@example.test' } },
    { supplierId: 'sup_2', status: 'declined', supplier: { email: 'sup2@example.test' } },
  ],
};

const actorOf = (fields: Partial<ResolvedEventOpsActor>) => ({ name: 'Actor', explicit: true, ...fields }) as ResolvedEventOpsActor;

describe('shared event scope: coordinators', () => {
  it.each([
    ['coordinator id', { role: 'coordinator', coordinatorId: 'coord_1' }, 'evt_1'],
    ['user id', { role: 'coordinator', id: 'user_coord' }, 'evt_1'],
    ['email, any case', { role: 'coordinator', email: 'COORD@example.test' }, 'evt_1'],
    ['no current assignment', { role: 'coordinator', coordinatorId: 'coord_9', id: 'user_other', email: 'other@example.test' }, undefined],
  ] as const)('gives event scope to a coordinator matched by %s only through an assignment', (_label, fields, expectedEventId) => {
    expect(scopeActorToEvent(actorOf(fields), event).actor.eventId).toBe(expectedEventId);
  });
});

describe('shared event scope: suppliers', () => {
  it.each([
    ['a selected booking', 'sup_1', true, ['evt_1']],
    ['a declined booking', 'sup_2', false, []],
    ['no booking', 'sup_9', false, []],
  ] as const)('reads files for a supplier with %s only when the booking is selected', (_label, supplierId, selected, fileScope) => {
    const actor = actorOf({ role: 'supplier', supplierId });
    expect(resolveFileEventScope(actor, event).scope.supplierEventIds).toEqual(fileScope);
    expect(scopeActorToEvent(actor, event).supplierBookingSelected).toBe(selected);
  });

  it('keeps the broader event scope used by event-games and floorplans for any booked supplier', () => {
    const declined = actorOf({ role: 'supplier', supplierId: 'sup_2' });
    expect(scopeActorToEvent(declined, event).scope.supplierEventIds).toEqual(['evt_1']);
  });
});
