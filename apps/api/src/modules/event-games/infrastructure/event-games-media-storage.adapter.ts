import { Injectable } from '@nestjs/common';
import { StorageObjectService } from '@prism/contexts/platform-ops';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { PrismVerifiedEventActor } from '@prism/types';
import type { GameMediaStoragePort } from '../contracts/game-media-storage.port';

@Injectable()
export class EventGamesMediaStorageAdapter implements GameMediaStoragePort {
  constructor(private readonly storage: StorageObjectService) {}

  validateReferences(
    input: { eventId: string; gameId: string; objectIds: string[] },
    transaction: PrismTransactionContext,
  ): Promise<void> {
    return this.storage.validateEventGameMediaReferences(input, transaction);
  }

  issueParticipantDownloadAuthorization(
    input: { eventId: string; gameId: string; objectId: string },
    transaction: PrismTransactionContext,
  ) {
    return this.storage.issueEventGameMediaDownloadAuthorization(input, transaction);
  }

  requestLobbyLogoUpload(input: Parameters<GameMediaStoragePort['requestLobbyLogoUpload']>[0]) {
    return this.storage.requestEventGameLobbyLogoUpload({
      eventId: input.eventId,
      ownerRecordType: 'event_game_lobby',
      ownerRecordId: input.eventId,
      logicalTarget: `lobby-logo:${input.request.idempotencyKey}`,
      usage: 'event_game_branding',
      fileName: input.request.fileName,
      contentType: input.request.contentType,
      declaredByteSize: input.request.declaredByteSize,
      checksumSha256: input.request.checksumSha256,
      idempotencyKey: input.request.idempotencyKey,
      actor: this.resolveActor(input.actor),
    });
  }

  requestGameMediaUpload(
    input: Parameters<GameMediaStoragePort['requestGameMediaUpload']>[0],
    transaction: PrismTransactionContext,
  ) {
    return this.storage.requestEventGameMediaUpload({
      eventId: input.eventId,
      gameId: input.gameId,
      ...input.request,
      actor: this.resolveActor(input.actor),
      context: transaction,
    });
  }

  async confirmLobbyLogoUpload(input: Parameters<GameMediaStoragePort['confirmLobbyLogoUpload']>[0]) {
    const object = await this.storage.confirmEventGameLobbyLogoUpload({
      eventId: input.eventId,
      objectId: input.objectId,
      checksumSha256: input.confirmation.checksumSha256,
      byteSize: input.confirmation.byteSize,
      actor: this.resolveActor(input.actor),
    });
    return { objectId: object.id };
  }

  async confirmGameMediaUpload(
    input: Parameters<GameMediaStoragePort['confirmGameMediaUpload']>[0],
    transaction: PrismTransactionContext,
  ) {
    const object = await this.storage.confirmEventGameMediaUpload({
      eventId: input.eventId,
      gameId: input.gameId,
      objectId: input.objectId,
      ...input.confirmation,
      actor: this.resolveActor(input.actor),
      context: transaction,
    });
    return { objectId: object.id };
  }

  validateLobbyLogoReference(input: Parameters<GameMediaStoragePort['validateLobbyLogoReference']>[0]) {
    return this.storage.validateEventGameLobbyLogoReference(input);
  }

  issueLobbyLogoDownloadAuthorization(
    input: Parameters<GameMediaStoragePort['issueLobbyLogoDownloadAuthorization']>[0],
    transaction: PrismTransactionContext,
  ) {
    return this.storage.issueEventGameLobbyLogoDownloadAuthorization(input, transaction);
  }

  private resolveActor(actor: PrismVerifiedEventActor) {
    return {
      id: actor.actorId,
      role: actor.actorRole,
      email: actor.actorEmail,
      name: actor.actorName,
      explicit: true,
      verified: true,
      eventId: actor.eventId,
      supplierId: actor.supplierId,
      coordinatorId: actor.coordinatorId,
    };
  }
}
