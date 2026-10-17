import { Injectable, NotFoundException } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { PrismaService } from '@prism/kernel/database';
import { OpsUserRole } from '@prism/kernel/event-core';
import {
  readEventAccessScope,
  readEventGameLobbyScope,
  readEventGameResponseRetentionScope,
  readEventGameWriteState,
  scopeActorToEvent,
} from '@prism/contexts/read-models/event-scope';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { PrismVerifiedEventActor } from '@prism/types';
import type { GameEventAccessPort } from '../contracts/game-event-access.port';

@Injectable()
export class EventGamesEventAccessAdapter implements GameEventAccessPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: EventAccessPolicyService,
  ) {}

  async getPublicEventScope(eventId: string, transaction: PrismTransactionContext) {
    const event = await readEventGameLobbyScope(transaction.prisma, eventId);
    return event ? { eventId: event.id, eventName: event.eventName, archived: event.archived, closed: event.closed } : null;
  }

  async getResponseRetentionScope(eventId: string, transaction: PrismTransactionContext) {
    return readEventGameResponseRetentionScope(transaction.prisma, eventId);
  }

  async isEventOpen(eventId: string, transaction: PrismTransactionContext): Promise<boolean> {
    return readEventGameWriteState(transaction.prisma, eventId);
  }

  async assertHostAccess(eventId: string, verifiedActor: PrismVerifiedEventActor): Promise<void> {
    const actor = this.accessPolicy.resolveActor({}, verifiedActor);
    await this.accessPolicy.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator],
      'event games host commands',
      eventId,
    );

    const event = await readEventAccessScope(this.prisma, eventId);
    if (!event) throw new NotFoundException('Event not found');
    if (actor.role === OpsUserRole.PmcmAdmin || actor.role === OpsUserRole.System) return;

    const scoped = scopeActorToEvent(actor, event);
    await this.accessPolicy.requireCanReadEvent(
      scoped.actor,
      event,
      'event games host commands',
      scoped.scope,
    );
  }

  async assertAdminAccess(eventId: string, verifiedActor: PrismVerifiedEventActor): Promise<void> {
    const actor = this.accessPolicy.resolveActor({}, verifiedActor);
    await this.accessPolicy.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin],
      'event game response review',
      eventId,
    );
    const event = await readEventAccessScope(this.prisma, eventId);
    if (!event) throw new NotFoundException('Event not found');
  }
}
