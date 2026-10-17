import type {
  PrismEventGameLobbyLogoUploadTicket,
  PrismEventGameMediaAuthorization,
  PrismEventGameMediaUploadTicket,
  PrismVerifiedEventActor,
  RequestEventGameMediaUploadInput,
  RequestEventGameLobbyLogoUploadInput,
} from '@prism/types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export const GAME_MEDIA_STORAGE = Symbol('GAME_MEDIA_STORAGE');

export interface GameMediaStoragePort {
  validateReferences(
    input: { eventId: string; gameId: string; objectIds: string[] },
    transaction: PrismTransactionContext,
  ): Promise<void>;
  issueParticipantDownloadAuthorization(
    input: { eventId: string; gameId: string; objectId: string },
    transaction: PrismTransactionContext,
  ): Promise<PrismEventGameMediaAuthorization>;
  requestLobbyLogoUpload(
    input: { eventId: string; actor: PrismVerifiedEventActor; request: RequestEventGameLobbyLogoUploadInput },
  ): Promise<PrismEventGameLobbyLogoUploadTicket>;
  requestGameMediaUpload(
    input: {
      eventId: string;
      gameId: string;
      actor: PrismVerifiedEventActor;
      request: RequestEventGameMediaUploadInput;
    },
    transaction: PrismTransactionContext,
  ): Promise<PrismEventGameMediaUploadTicket>;
  confirmLobbyLogoUpload(input: {
    eventId: string;
    objectId: string;
    actor: PrismVerifiedEventActor;
    confirmation: { checksumSha256: string; byteSize: number };
  }): Promise<{ objectId: string }>;
  confirmGameMediaUpload(input: {
    eventId: string;
    gameId: string;
    objectId: string;
    actor: PrismVerifiedEventActor;
    confirmation: { checksumSha256: string; byteSize: number };
  }, transaction: PrismTransactionContext): Promise<{ objectId: string }>;
  validateLobbyLogoReference(input: { eventId: string; objectId: string }): Promise<void>;
  issueLobbyLogoDownloadAuthorization(
    input: { eventId: string; objectId: string },
    transaction: PrismTransactionContext,
  ): Promise<PrismEventGameMediaAuthorization>;
}
