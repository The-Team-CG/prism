import type { PrismEventGameKind } from '@prism/types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export const GAME_DEFINITION_STORE = Symbol('GAME_DEFINITION_STORE');

export type GameDefinitionEntryMode = 'active' | 'independent';
export type GameDefinitionStatus = 'draft' | 'published' | 'removed';

export interface GameDefinitionRecord {
  id: string;
  eventId: string;
  slug: string;
  title: string;
  kind: PrismEventGameKind;
  entryMode: GameDefinitionEntryMode;
  status: GameDefinitionStatus;
  version: number;
  config: Readonly<Record<string, unknown>>;
  availableFrom: Date | null;
  availableUntil: Date | null;
  hasStartedSession?: boolean;
  configVersionId?: string;
}

export interface CreateGameDraftRecord {
  id: string;
  eventId: string;
  slug: string;
  title: string;
  kind: PrismEventGameKind;
  entryMode: GameDefinitionEntryMode;
  status: 'draft';
  createdBy: string;
  version: 1;
  config: Readonly<Record<string, unknown>>;
  availableFrom: Date | null;
  availableUntil: Date | null;
}

export interface AppendGameDraftVersionRecord {
  eventId: string;
  gameId: string;
  actorId: string;
  status: 'draft' | 'published';
  title: string;
  version: number;
  config: Readonly<Record<string, unknown>>;
  availableFrom: Date | null;
  availableUntil: Date | null;
}

export interface RemovedGameRecord {
  game: GameDefinitionRecord;
  beforeStatus: GameDefinitionStatus;
  beforeVersion: number;
  cancelledSessionIds?: string[];
}

export interface GameDefinitionStorePort {
  listForEvent(eventId: string, transaction: PrismTransactionContext): Promise<GameDefinitionRecord[]>;
  findForEvent(
    scope: { eventId: string; gameId: string },
    transaction: PrismTransactionContext,
  ): Promise<GameDefinitionRecord | null>;
  createDraft(input: CreateGameDraftRecord, transaction: PrismTransactionContext): Promise<GameDefinitionRecord>;
  findDraftForUpdate(
    scope: { eventId: string; gameId: string },
    transaction: PrismTransactionContext,
  ): Promise<GameDefinitionRecord | null>;
  appendDraftVersion(
    input: AppendGameDraftVersionRecord,
    transaction: PrismTransactionContext,
  ): Promise<GameDefinitionRecord>;
  removeUnstartedGame(
    scope: { eventId: string; gameId: string; actorId: string },
    transaction: PrismTransactionContext,
  ): Promise<RemovedGameRecord | null>;
  publishDraft(
    scope: { eventId: string; gameId: string; actorId: string; expectedVersion: number },
    transaction: PrismTransactionContext,
  ): Promise<RemovedGameRecord | null>;
}
