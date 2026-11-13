import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Post, Put, Query, Req, StreamableFile, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {
  confirmStorageUploadSchema,
  copyStorageObjectSchema,
  copyStorageObjectToThreadSchema,
  setStorageObjectExpirySchema,
  requestStorageUploadSchema,
  searchClientStoredFilesQuerySchema,
  type ConfirmStorageUploadInput,
  type CopyStorageObjectInput,
  type CopyStorageObjectToThreadInput,
  type SetStorageObjectExpiryInput,
  type SearchClientStoredFilesQuery,
  type RequestStorageUploadInput,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { zodBody, zodQuery } from '@prism/kernel/shared';
import { StorageObjectService } from '../../application/storage/storage-object.service';

@Controller('storage/objects')
@UseGuards(EventSessionGuard)
export class StorageController {
  constructor(
    private readonly storage: StorageObjectService,
    private readonly accessPolicy: EventAccessPolicyService,
  ) {}

  @Post('upload-request')
  requestUpload(
    @Body(zodBody(requestStorageUploadSchema)) input: RequestStorageUploadInput,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.storage.requestUpload({ ...input, actor: this.accessPolicy.resolveEventScopedActor(actor) });
  }

  /** The signed-in client's files across all of their events, by file name. */
  @Get('client-files')
  searchClientFiles(@Query(zodQuery(searchClientStoredFilesQuerySchema)) query: SearchClientStoredFilesQuery, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.storage.searchClientObjects(this.accessPolicy.resolveEventScopedActor(actor), query.query);
  }

  /** Copies a readable stored file into another event as a new client document; the server moves the bytes. */
  @Post(':objectId/copies')
  copyObject(
    @Param('objectId') objectId: string,
    @Body(zodBody(copyStorageObjectSchema)) input: CopyStorageObjectInput,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.storage.copyToClientEvent({ sourceObjectId: objectId, ...input, actor: this.accessPolicy.resolveEventScopedActor(actor) });
  }

  /** Attaches a file of the same event that the actor can download to a conversation, as a conversation-owned copy. */
  @Post(':objectId/thread-copies')
  copyObjectToThread(
    @Param('objectId') objectId: string,
    @Body(zodBody(copyStorageObjectToThreadSchema)) input: CopyStorageObjectToThreadInput,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.storage.copyToThread({ sourceObjectId: objectId, threadId: input.threadId, actor: this.accessPolicy.resolveEventScopedActor(actor) });
  }

  /** Sets or clears the last day a stored document is valid: PMCM for any file, others for their own uploads. */
  @Put(':objectId/expiry')
  setExpiry(
    @Param('objectId') objectId: string,
    @Body(zodBody(setStorageObjectExpirySchema)) input: SetStorageObjectExpiryInput,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.storage.setObjectExpiry({ objectId, expiresAt: input.expiresAt, actor: this.accessPolicy.resolveEventScopedActor(actor) });
  }

  @Get('events/:eventId')
  listEventObjects(@Param('eventId') eventId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.storage.listEventObjects(eventId, this.accessPolicy.resolveEventScopedActor(actor));
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
    await this.storage.writeAuthorizedUpload({ objectId, uploadUrl, bytes, actor: this.accessPolicy.resolveEventScopedActor(actor) });
  }

  @Get(':objectId/content')
  async downloadContent(
    @Param('objectId') objectId: string,
    @Headers('x-prism-storage-authorization') downloadUrl: string,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    const bytes = await this.storage.readAuthorizedDownload({ objectId, downloadUrl, actor: this.accessPolicy.resolveEventScopedActor(actor) });
    return new StreamableFile(Buffer.from(bytes));
  }

  @Post(':objectId/confirm')
  confirmUpload(
    @Param('objectId') objectId: string,
    @Body(zodBody(confirmStorageUploadSchema)) input: ConfirmStorageUploadInput,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.storage.confirmUpload({ ...input, objectId, actor: this.accessPolicy.resolveEventScopedActor(actor) });
  }

  @Get(':objectId/download-authorization')
  downloadAuthorization(@Param('objectId') objectId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.storage.issueDownloadAuthorization({ objectId, actor: this.accessPolicy.resolveEventScopedActor(actor) });
  }

  @Delete(':objectId')
  deleteObject(@Param('objectId') objectId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.storage.deleteObject({ objectId, actor: this.accessPolicy.resolveEventScopedActor(actor) });
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
