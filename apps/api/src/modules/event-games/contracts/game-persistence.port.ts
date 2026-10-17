import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export const GAME_PERSISTENCE = Symbol('GAME_PERSISTENCE');

export type GameResourceType = 'definition' | 'session' | 'configuration' | 'participation' | 'reward' | 'join_pin' | 'lobby';

export type GameHostAction =
  | 'create_game'
  | 'update_game'
  | 'publish_game'
  | 'remove_game'
  | 'create_session'
  | 'schedule_session'
  | 'start_session'
  | 'pause_session'
  | 'resume_session'
  | 'advance_round'
  | 'spin_wheel'
  | 'end_session'
  | 'cancel_session'
  | 'disable_joins'
  | 'enable_joins'
  | 'assign_reward'
  | 'moderate_participant'
  | 'revoke_joining'
  | 'provision_lobby'
  | 'update_lobby_branding';

export type GameHostMutationOutcome =
  | 'created'
  | 'updated'
  | 'already_exists'
  | 'published'
  | 'removed'
  | 'created'
  | 'scheduled'
  | 'started'
  | 'paused'
  | 'resumed'
  | 'advanced'
  | 'spun'
  | 'already_exists'
  | 'ended'
  | 'cancelled'
  | 'joins_disabled'
  | 'joins_enabled'
  | 'assigned'
  | 'moderated'
  | 'revoked';

/** Non-sensitive state labels allowed in the event-game audit summary. */
export type GameAuditSafeStatus =
  | 'draft'
  | 'published'
  | 'scheduled'
  | 'lobby'
  | 'active'
  | 'live'
  | 'paused'
  | 'ended'
  | 'completed'
  | 'cancelled'
  | 'archived'
  | 'removed'
  | 'revoked'
  | 'hidden'
  | 'prism'
  | 'ocean'
  | 'sunset'
  | 'forest'
  | 'open'
  | 'closed'
  | 'pending'
  | 'visible'
  | 'assigned';

/** Persisted, allowlisted before/after state summary; never caller-provided snapshots. */
export interface GamePersistedTransition {
  beforeStatus: GameAuditSafeStatus | null;
  afterStatus: GameAuditSafeStatus | null;
  beforeVersion: number | null;
  afterVersion: number | null;
}

export interface GameHostCommandInput {
  eventId: string;
  actorId: string;
  resourceType: GameResourceType;
  resourceId: string;
  action: GameHostAction;
  command: Readonly<Record<string, unknown>>;
  requestReceiptId: string;
}

/** Identifiers and outcome returned from the persisted command, never caller snapshots. */
export interface PersistedGameHostCommand {
  eventId: string;
  resourceType: GameResourceType;
  resourceId: string;
  action: GameHostAction;
  outcome: GameHostMutationOutcome;
  resultId: string;
  requestReceiptId: string;
  transition: GamePersistedTransition;
  /** Internal generation slot only; never contains a raw PIN. */
  generationAttempt?: number;
  pinExpiresAt?: Date;
}

export interface GamePersistencePort {
  /** Implementations must resolve and mutate the resource with a compound eventId/resourceId scope. */
  executeHostCommand(
    input: GameHostCommandInput,
    transaction: PrismTransactionContext,
  ): Promise<PersistedGameHostCommand>;
}
