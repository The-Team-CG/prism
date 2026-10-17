import type { PrismEventGameBrandTheme, PrismEventGameKind } from '@prism/types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export const GAME_LOBBY_STORE = Symbol('GAME_LOBBY_STORE');

export interface PublicIndependentGameRecord {
  id: string;
  eventId?: string;
  title: string;
  kind: PrismEventGameKind;
  status: string;
  entryMode: string;
  availableFrom: Date | null;
  availableUntil: Date | null;
  config?: Readonly<Record<string, unknown>>;
  configVersionId?: string;
  archivedAt?: Date | null;
}

export interface IndependentGameSessionRecord {
  sessionId: string;
  title: string;
  kind: PrismEventGameKind;
  status: 'live';
}

export interface ExistingIndependentGameStartRecord {
  eventId: string;
  gameId: string;
  sessionId: string;
  title: string;
  kind: PrismEventGameKind;
  status: string;
  /** Null means no active event-scoped credential grant remains. */
  tokenDigest: string | null;
}

export interface CreateIndependentGameSessionRecord {
  eventId: string;
  gameId: string;
  idempotencyKey: string;
  tokenDigest: string;
  credentialId: string;
  createCredential: boolean;
  sessionId: string;
  grantId: string;
}

export interface GameLobbyBrandingRecord {
  theme: PrismEventGameBrandTheme;
  primaryColor: string | null;
  secondaryColor: string | null;
  logoObjectId: string | null;
}

export interface GameLobbyStorePort {
  findEventIdForLobbySlug(eventSlug: string, transaction: PrismTransactionContext): Promise<string | null>;
  findLobbyBranding(eventId: string, transaction: PrismTransactionContext): Promise<GameLobbyBrandingRecord | null>;
  listPublicIndependentGames(eventId: string, transaction: PrismTransactionContext): Promise<PublicIndependentGameRecord[]>;
  findPublishedIndependentGame(
    scope: { eventId: string; gameId: string },
    transaction: PrismTransactionContext,
  ): Promise<PublicIndependentGameRecord | null>;
  findExistingIndependentStart(
    scope: { eventId: string; idempotencyKey: string },
    transaction: PrismTransactionContext,
  ): Promise<ExistingIndependentGameStartRecord | null>;
  createIndependentSessionAndGrant(
    input: CreateIndependentGameSessionRecord,
    transaction: PrismTransactionContext,
  ): Promise<IndependentGameSessionRecord>;
}
