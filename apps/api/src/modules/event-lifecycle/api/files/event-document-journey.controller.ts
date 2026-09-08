import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  confirmStorageUploadSchema,
  requestStorageUploadSchema,
  type ConfirmStorageUploadInput,
  type PrismVerifiedEventActor,
  type RequestStorageUploadInput,
} from '@prism/types';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { StorageObjectService } from '@prism/contexts/platform-ops';

@Controller('events/:eventId/documents')
@UseGuards(EventSessionGuard)
export class EventDocumentJourneyController {
  constructor(
    private readonly storage: StorageObjectService,
    private readonly accessPolicy: EventAccessPolicyService,
  ) {}

  @Get()
  list(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.storage.listEventObjects(eventId, this.actor(verified));
  }

  @Post('upload-request')
  requestUpload(
    @Param('eventId') eventId: string,
    @Body(zodBody(requestStorageUploadSchema)) input: RequestStorageUploadInput,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    if (input.eventId !== eventId) throw new BadRequestException('Request event scope does not match the route');
    return this.storage.requestUpload({ ...input, actor: this.actor(verified) });
  }

  @Post(':objectId/confirm')
  confirmUpload(
    @Param('objectId') objectId: string,
    @Body(zodBody(confirmStorageUploadSchema)) input: ConfirmStorageUploadInput,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    return this.storage.confirmUpload({ ...input, objectId, actor: this.actor(verified) });
  }

  @Get(':objectId/download-authorization')
  downloadAuthorization(@Param('objectId') objectId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.storage.issueDownloadAuthorization({ objectId, actor: this.actor(verified) });
  }

  private actor(actor: PrismVerifiedEventActor) {
    return this.accessPolicy.resolveActor({}, actor);
  }
}
