import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { OpsEvent } from '@prisma/client';
import type { PrismEventOpsActorContext } from '@prism/types';
import { AuditActionType, AuditCategory, OpsUserRole, type OpsUserRole as OpsUserRoleValue } from '@prism/modules/event-core';
import { AuditService } from '@prism/modules/trust-ops';

export type EventOpsActorInput = PrismEventOpsActorContext;

export type ResolvedEventOpsActor = {
  id?: string;
  role: OpsUserRoleValue;
  email?: string;
  name: string;
  clientName?: string;
  supplierId?: string;
  coordinatorId?: string;
  eventId?: string;
  accessCode?: string;
  explicit: boolean;
};

type ReadableEvent = Pick<OpsEvent, 'id' | 'clientName' | 'clientPortalStatus'>;

type EventAccessScope = {
  supplierEventIds?: readonly string[];
};

@Injectable()
export class EventAccessPolicyService {
  private readonly logger = new Logger(EventAccessPolicyService.name);

  constructor(private readonly auditService: AuditService) {}

  resolveActor(input: EventOpsActorInput = {}): ResolvedEventOpsActor {
    const requestedRole = (input.actorRole ?? input.role ?? OpsUserRole.PmcmAdmin).trim().toLowerCase();
    const knownRoles = Object.values(OpsUserRole) as OpsUserRoleValue[];
    const role = knownRoles.includes(requestedRole as OpsUserRoleValue)
      ? (requestedRole as OpsUserRoleValue)
      : OpsUserRole.Unknown;
    const name =
      input.actorName ??
      input.name ??
      input.clientName ??
      (role === OpsUserRole.PmcmAdmin ? 'PMCM Admin' : role);

    return {
      id: input.actorId ?? input.id,
      role,
      email: input.actorEmail ?? input.email,
      name,
      clientName: input.clientName ?? (role === OpsUserRole.Client ? name : undefined),
      supplierId: input.supplierId,
      coordinatorId: input.coordinatorId,
      eventId: input.eventId,
      accessCode: input.accessCode,
      explicit: Boolean(input.actorRole ?? input.role),
    };
  }

  async requireActorRole(
    actor: ResolvedEventOpsActor,
    allowedRoles: OpsUserRoleValue[],
    resource: string,
    eventId?: string,
  ) {
    if (allowedRoles.includes(actor.role)) return;

    await this.recordForbiddenAccess(actor, resource, eventId);
    throw new ForbiddenException(`${actor.role} cannot access ${resource}`);
  }

  canReadEvent(actor: ResolvedEventOpsActor, event: ReadableEvent, scope: EventAccessScope = {}) {
    if (actor.role === OpsUserRole.PmcmAdmin || actor.role === OpsUserRole.System) return true;
    if (actor.role === OpsUserRole.Client) {
      return event.clientPortalStatus === 'unlocked' && this.sameText(actor.clientName, event.clientName);
    }
    if (actor.role === OpsUserRole.Coordinator) {
      return Boolean(actor.eventId && actor.eventId === event.id);
    }
    if (actor.role === OpsUserRole.Supplier) {
      if (actor.eventId && actor.eventId !== event.id) return false;
      return Boolean(scope.supplierEventIds?.includes(event.id));
    }
    return false;
  }

  async requireCanReadEvent(actor: ResolvedEventOpsActor, event: ReadableEvent, resource: string, scope: EventAccessScope = {}) {
    if (this.canReadEvent(actor, event, scope)) return;
    await this.recordForbiddenAccess(actor, resource, event.id);
    throw new ForbiddenException(`${actor.role} cannot access ${resource}`);
  }

  filterEventsForActor<T extends ReadableEvent>(actor: ResolvedEventOpsActor, events: T[], scope: EventAccessScope = {}) {
    return events.filter((event) => this.canReadEvent(actor, event, scope));
  }

  canMutateOfficialFloorplan(actor: ResolvedEventOpsActor) {
    return actor.role === OpsUserRole.PmcmAdmin || actor.role === OpsUserRole.System;
  }

  async requireCanMutateOfficialFloorplan(actor: ResolvedEventOpsActor, eventId: string, resource: string) {
    if (this.canMutateOfficialFloorplan(actor)) return;
    await this.recordForbiddenAccess(actor, resource, eventId);
    throw new ForbiddenException(`${actor.role} cannot mutate official floorplans`);
  }

  canViewInternalCosts(actor: ResolvedEventOpsActor) {
    return actor.role === OpsUserRole.PmcmAdmin || actor.role === OpsUserRole.System;
  }

  async requireCanViewInternalCosts(actor: ResolvedEventOpsActor, eventId: string, resource: string) {
    if (this.canViewInternalCosts(actor)) return;
    await this.recordForbiddenAccess(actor, resource, eventId);
    throw new ForbiddenException(`${actor.role} cannot view internal costs`);
  }

  canViewPrivacyOperations(actor: ResolvedEventOpsActor) {
    return actor.role === OpsUserRole.PmcmAdmin || actor.role === OpsUserRole.System;
  }

  async requireCanViewPrivacyOperations(actor: ResolvedEventOpsActor, resource: string, eventId?: string) {
    if (this.canViewPrivacyOperations(actor)) return;
    await this.recordForbiddenAccess(actor, resource, eventId);
    throw new ForbiddenException(`${actor.role} cannot access privacy operations`);
  }

  sameText(left?: string | null, right?: string | null) {
    return Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());
  }

  async recordForbiddenAccess(actor: ResolvedEventOpsActor, resource: string, eventId?: string) {
    try {
      await this.auditService.audit(eventId, actor.name, `403 forbidden access: ${resource}`, {
        actorRole: actor.role,
        actorEmail: actor.email,
        actionType: AuditActionType.ForbiddenAccess,
        category: AuditCategory.Access,
        affectedType: 'scoped_read',
        affectedLabel: resource,
        severity: 'warning',
        metadata: {
          actorId: actor.id,
          role: actor.role,
          clientName: actor.clientName,
          supplierId: actor.supplierId,
          coordinatorId: actor.coordinatorId,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Forbidden access audit log could not be recorded: ${message}`);
    }
  }
}
