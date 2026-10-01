import { ForbiddenException } from '@nestjs/common';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';

export function requireVerifiedTrustActor(
  actor: ResolvedEventOpsActor | undefined,
  action: string,
): ResolvedEventOpsActor & { id: string; verified: true } {
  const id = actor?.id?.trim();
  const name = actor?.name?.trim();
  const email = actor?.email?.trim();
  if (
    actor?.verified !== true ||
    !id ||
    !name ||
    (actor.role !== OpsUserRole.PmcmAdmin && actor.role !== OpsUserRole.System) ||
    (actor.role === OpsUserRole.PmcmAdmin && !email)
  ) {
    throw new ForbiddenException('A verified PMCM or system actor is required for ' + action);
  }
  return { ...actor, id, name, email: email || undefined, verified: true };
}