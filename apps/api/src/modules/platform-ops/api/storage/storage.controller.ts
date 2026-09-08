import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  confirmStorageUploadSchema,
  requestStorageUploadSchema,
  type ConfirmStorageUploadInput,
  type RequestStorageUploadInput,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { StorageObjectService } from '../../application/storage/storage-object.service';

@Controller('storage/objects')
@UseGuards(EventSessionGuard)
export class StorageController {
  constructor(private readonly storage: StorageObjectService) {}

  @Post('upload-request')
  requestUpload(
    @Body(zodBody(requestStorageUploadSchema)) input: RequestStorageUploadInput,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.storage.requestUpload({ ...input, actor: this.resolveActor(actor) });
  }

  @Post(':objectId/confirm')
  confirmUpload(
    @Param('objectId') objectId: string,
    @Body(zodBody(confirmStorageUploadSchema)) input: ConfirmStorageUploadInput,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.storage.confirmUpload({ ...input, objectId, actor: this.resolveActor(actor) });
  }

  @Get(':objectId/download-authorization')
  downloadAuthorization(@Param('objectId') objectId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.storage.issueDownloadAuthorization({ objectId, actor: this.resolveActor(actor) });
  }

  @Delete(':objectId')
  deleteObject(@Param('objectId') objectId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.storage.deleteObject({ objectId, actor: this.resolveActor(actor) });
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
