import type { PrismVerifiedEventActor } from '@prism/types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export const GAME_EVENT_ACCESS = Symbol('GAME_EVENT_ACCESS');

export interface PublicEventLobbyScope {
  eventId: string;
  eventName: string;
  archived: boolean;
  closed: boolean;
}

export interface EventResponseRetentionScope {
  eventId: string;
  closed: boolean;
  archivedAt: Date | null;
}

export interface GameEventAccessPort {
  assertHostAccess(eventId: string, actor: PrismVerifiedEventActor): Promise<void>;
  assertAdminAccess(eventId: string, actor: PrismVerifiedEventActor): Promise<void>;
  getPublicEventScope(eventId: string, transaction: PrismTransactionContext): Promise<PublicEventLobbyScope | null>;
  getResponseRetentionScope(
    eventId: string,
    transaction: PrismTransactionContext,
  ): Promise<EventResponseRetentionScope | null>;
  isEventOpen(eventId: string, transaction: PrismTransactionContext): Promise<boolean>;
}
