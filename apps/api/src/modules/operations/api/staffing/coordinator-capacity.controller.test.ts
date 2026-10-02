import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { CoordinatorSuggestionsQueryInput } from '@prism/types';
import { OpsCoordinatorCapacityController } from './coordinator-capacity.controller';

function createController(role: OpsUserRole) {
  const actor = { id: 'actor_1', role, name: 'Staff' };
  const eventAccessPolicyService = {
    resolveActor: vi.fn(() => actor),
    requireActorRole: vi.fn(async (_actor: typeof actor, roles: OpsUserRole[], _resource: string, _eventId: string) => {
      if (!roles.includes(role)) throw new ForbiddenException('Not authorized');
    }),
  };
  const coordinatorSuggestionsService = {
    listForEvent: vi.fn(async () => [{ id: 'coord_1', name: 'Rhea', role: 'Usher' }]),
  };
  const controller = new OpsCoordinatorCapacityController(
    {} as never,
    eventAccessPolicyService as never,
    coordinatorSuggestionsService as never,
  );

  return { actor, controller, coordinatorSuggestionsService, eventAccessPolicyService };
}

describe('OpsCoordinatorCapacityController coordinator suggestions', () => {
  it.each([OpsUserRole.PmcmAdmin, OpsUserRole.System])('allows %s with event-scoped access', async (role) => {
    const { actor, controller, coordinatorSuggestionsService, eventAccessPolicyService } = createController(role);
    const verifiedActor = { role } as never;
    const query: CoordinatorSuggestionsQueryInput = { role: 'Usher', skills: ['registration'] };

    await expect(controller.getCoordinatorSuggestions('evt_1', query, verifiedActor)).resolves.toEqual([
      { id: 'coord_1', name: 'Rhea', role: 'Usher' },
    ]);

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(eventAccessPolicyService.requireActorRole).toHaveBeenCalledWith(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'coordinator suggestions',
      'evt_1',
    );
    expect(coordinatorSuggestionsService.listForEvent).toHaveBeenCalledWith('evt_1', query);
  });

  it('rejects coordinators and never queries suggestions for their own event', async () => {
    const { controller, coordinatorSuggestionsService, eventAccessPolicyService } = createController(OpsUserRole.Coordinator);

    await expect(
      controller.getCoordinatorSuggestions('evt_1', { role: 'Usher', skills: [] }, {} as never),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(eventAccessPolicyService.requireActorRole).toHaveBeenCalled();
    expect(coordinatorSuggestionsService.listForEvent).not.toHaveBeenCalled();
  });
});
