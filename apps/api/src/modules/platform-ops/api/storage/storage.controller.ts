import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Post, Req, StreamableFile, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
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

  @Get('events/:eventId')
  listEventObjects(@Param('eventId') eventId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.storage.listEventObjects(eventId, this.resolveActor(actor));
  }

  @Post(':objectId/content')
  @HttpCode(HttpStatus.NO_CONTENT)
  async uploadContent(
    @Param('objectId') objectId: string,
    @Headers('x-prism-storage-authorization') uploadUrl: string,
    @Req() request: Request,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    const bytes = await this.readRequestBytes(request);
    await this.storage.writeAuthorizedUpload({ objectId, uploadUrl, bytes, actor: this.resolveActor(actor) });
  }

  @Get(':objectId/content')
  async downloadContent(
    @Param('objectId') objectId: string,
    @Headers('x-prism-storage-authorization') downloadUrl: string,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    const bytes = await this.storage.readAuthorizedDownload({ objectId, downloadUrl, actor: this.resolveActor(actor) });
    return new StreamableFile(Buffer.from(bytes));
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

  private async readRequestBytes(request: Request) {
    const maximumBytes = 250 * 1024 * 1024;
    const declaredLength = Number(request.headers['content-length']);
    if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
      throw new BadRequestException('Uploaded bytes exceed the maximum file size');
    }
    const chunks: Buffer[] = [];
    let byteSize = 0;
    for await (const chunk of request as unknown as AsyncIterable<Uint8Array>) {
      const bytes = Buffer.from(chunk);
      byteSize += bytes.byteLength;
      if (byteSize > maximumBytes) throw new BadRequestException('Uploaded bytes exceed the maximum file size');
      chunks.push(bytes);
    }
    if (byteSize === 0) throw new BadRequestException('Uploaded file is empty');
    return Buffer.concat(chunks, byteSize);
  }
}
