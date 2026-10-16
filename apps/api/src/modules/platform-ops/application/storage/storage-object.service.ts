import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import type { OpsStoredObject, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole, type OpsUserRole as OpsUserRoleValue } from '@prism/kernel/event-core';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { PrismEventGameLobbyLogoUploadTicket, PrismEventGameMediaAuthorization, PrismEventGameMediaUploadTicket, PrismStorageDownloadAuthorization, PrismStoredObject, StorageUsage } from '@prism/types';
import { PLATFORM_REFERENCE_READ_MODEL, type PlatformReferenceReadModel } from '@prism/contexts/read-models';
import { readEventAccessScope, scopeActorToEvent } from '@prism/contexts/read-models/event-scope';
import {
  STORAGE_ADAPTER,
  type StorageAdapter,
  type StorageAdapterRequest,
  type StorageRequestResult,
  type StorageServiceConfirmation,
  type StorageServiceByteDownload,
  type StorageServiceByteUpload,
  type StorageServiceDeletion,
  type StorageServiceDownload,
  type StorageServiceRequest,
  type StorageUploadLocation,
  type StoredSupplierUploadLookup,
  type StoredSupplierUploadReader,
  type StoredSupplierUploadReference,
} from '../../contracts/storage/storage.port';
import { StorageValidationService } from './storage-validation.service';

export const STORAGE_RETENTION_POLICY_SEAM = 'Retention and legal-hold policy is owned by W29 and is not implemented here';

// Keep the generic storage API closed to owner pairs without production callers.
// This allowlist does not validate target-row existence; each owner capability must do that.
const STORAGE_OWNER_USAGE_REGISTRY: Readonly<Record<string, readonly StorageUsage[]>> = {
  billing_statement: ['event_deliverable'],
  event: ['client_document', 'signed_conforme'],
  event_game_definition: ['event_game_media'],
  event_game_lobby: ['event_game_branding'],
  supplier: ['supplier_document'],
};

function isConfirmedSupplierUpload(object: OpsStoredObject | null, input: StoredSupplierUploadLookup): object is OpsStoredObject {
  if (!object) return false;
  const targetSuffix = object.logicalTarget.slice(input.logicalTargetPrefix.length);
  const validTarget = object.logicalTarget.startsWith(input.logicalTargetPrefix) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetSuffix);
  const validChecksum = !input.checksumSha256 || object.checksumSha256.toLowerCase() === input.checksumSha256.toLowerCase();
  return object.eventId === input.eventId && object.usage === 'supplier_document' &&
    object.ownerRecordType === 'supplier' && object.ownerRecordId === input.supplierId &&
    object.lifecycleState === 'stored' && validTarget && validChecksum;
}

function isSupportedStorageOwner(ownerRecordType: string, usage: string) {
  return STORAGE_OWNER_USAGE_REGISTRY[ownerRecordType]?.includes(usage as StorageUsage) ?? false;
}

function sameUploadOwnerAndActor(object: OpsStoredObject, input: StorageServiceRequest) {
  return object.eventId === input.eventId && object.ownerRecordType === input.ownerRecordType &&
    object.ownerRecordId === input.ownerRecordId && object.uploaderActorId === (input.actor.id ?? 'unknown') &&
    object.uploaderActorRole === input.actor.role && object.usage === input.usage && object.logicalTarget === input.logicalTarget;
}

function sameUploadContent(object: OpsStoredObject, input: StorageServiceRequest, declaration: ReturnType<StorageValidationService['validateDeclaration']>) {
  return object.contentType === declaration.contentType && object.declaredByteSize === declaration.byteSize &&
    object.checksumSha256 === declaration.checksumSha256 && object.eventId === input.eventId;
}

@Injectable()
export class StorageObjectService implements StoredSupplierUploadReader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: EventAccessPolicyService,
    private readonly validation: StorageValidationService,
    @Optional() @Inject(STORAGE_ADAPTER) private readonly adapter?: StorageAdapter,
    @Optional() @Inject(PLATFORM_REFERENCE_READ_MODEL) private readonly platformReferences?: PlatformReferenceReadModel,
  ) {}

  async findConfirmedSupplierUpload(input: StoredSupplierUploadLookup): Promise<StoredSupplierUploadReference | null> {
    const object = await this.prisma.opsStoredObject.findUnique({ where: { id: input.objectId } });
    if (!isConfirmedSupplierUpload(object, input)) return null;
    return {
      id: object.id,
      originalFileName: object.originalFileName,
      contentType: object.contentType,
      declaredByteSize: object.declaredByteSize,
      checksumSha256: object.checksumSha256,
    };
  }

  async requestUpload(input: StorageServiceRequest): Promise<StorageRequestResult> {
    if (input.usage === 'event_game_media') {
      throw new ForbiddenException('Game media uploads must use the game-scoped route');
    }
    return this.requestUploadThroughOwnerCapability(input);
  }

  private async requestUploadThroughOwnerCapability(
    input: StorageServiceRequest,
  ): Promise<StorageRequestResult> {
    this.assertEventGameLobbyLogoOwner(input);
    this.assertSupportedOwner(input.ownerRecordType, input.usage);
    const prisma = this.database(input.context);
    input = { ...input, actor: await this.authorizeEvent(input.eventId, input.actor, input.usage, 'request storage upload') };
    await this.assertUploadOwner(input);
    const declaration = this.declaration(input);
    const objectId = `obj_${randomUUID()}`;
    const providerObjectKey = this.providerObjectKey(input.eventId, input.usage, objectId, declaration.fileName);
    const existing = await this.findExisting(input, input.context);
    if (existing) {
      this.assertSameLogicalContent(existing, input, declaration);
      await this.assertCanAccessObject(input.actor, existing, 'reuse storage upload');
    }
    if (existing?.lifecycleState === 'stored') return { status: 'stored', object: this.mapObject(existing) };
    if (!this.adapter) return this.recordUnavailable(input, declaration, objectId, providerObjectKey);
    const adapterInput = this.adapterRequestForDeclaration(input, declaration, objectId, providerObjectKey, existing);
    const location = await this.requestLocation(adapterInput);
    if (!location) return this.recordUnavailable(input, declaration, objectId, providerObjectKey, 'Storage provider could not issue an upload location');
    if (existing) return this.resumeRequest(existing, location, input.context);
    return this.createRequest(input, declaration, objectId, location);
  }

  async requestEventGameLobbyLogoUpload(input: StorageServiceRequest): Promise<PrismEventGameLobbyLogoUploadTicket> {
    this.assertEventGameLobbyLogoOwner(input);
    if (input.ownerRecordType !== 'event_game_lobby' || input.usage !== 'event_game_branding') {
      throw new BadRequestException('Lobby logo storage must stay scoped to its event lobby');
    }
    const result = await this.requestUpload(input);
    if (result.status === 'stored') {
      return { objectId: result.object.id, uploadUrl: null, expiresAt: null, alreadyStored: true };
    }
    if (result.status === 'ready') {
      return {
        objectId: result.object.id,
        uploadUrl: result.location.uploadUrl,
        expiresAt: result.location.expiresAt.toISOString(),
        alreadyStored: false,
      };
    }
    throw new ServiceUnavailableException('Event game lobby logo storage is not available');
  }

  async requestEventGameMediaUpload(input: {
    eventId: string;
    gameId: string;
    fileName: string;
    contentType: string;
    declaredByteSize: number;
    checksumSha256: string;
    idempotencyKey: string;
    actor: ResolvedEventOpsActor;
    context?: PrismTransactionContext;
  }): Promise<PrismEventGameMediaUploadTicket> {
    const result = await this.requestUploadThroughOwnerCapability({
      eventId: input.eventId,
      ownerRecordType: 'event_game_definition',
      ownerRecordId: input.gameId,
      logicalTarget: `game-media:${input.gameId}:${input.idempotencyKey}`,
      usage: 'event_game_media',
      fileName: input.fileName,
      contentType: input.contentType,
      declaredByteSize: input.declaredByteSize,
      checksumSha256: input.checksumSha256,
      idempotencyKey: input.idempotencyKey,
      actor: input.actor,
      context: input.context,
    });
    if (result.status === 'stored') {
      return { objectId: result.object.id, uploadUrl: null, expiresAt: null, alreadyStored: true };
    }
    if (result.status === 'ready') {
      return {
        objectId: result.object.id,
        uploadUrl: result.location.uploadUrl,
        expiresAt: result.location.expiresAt.toISOString(),
        alreadyStored: false,
      };
    }
    throw new ServiceUnavailableException('Event game media storage is not available');
  }

  async confirmUpload(input: StorageServiceConfirmation): Promise<PrismStoredObject> {
    const existing = await this.database(input.context).opsStoredObject.findUnique({ where: { id: input.objectId } });
    if (existing?.usage === 'event_game_media') {
      throw new ForbiddenException('Game media uploads must use the game-scoped route');
    }
    return this.confirmUploadThroughOwnerCapability(input);
  }

  private async confirmUploadThroughOwnerCapability(
    input: StorageServiceConfirmation,
  ): Promise<PrismStoredObject> {
    const prisma = this.database(input.context);
    const current = await prisma.opsStoredObject.findUnique({ where: { id: input.objectId } });
    if (!current) throw new NotFoundException('Stored object not found');
    this.assertEventGameLobbyLogoOwner({
      eventId: current.eventId,
      ownerRecordType: current.ownerRecordType,
      ownerRecordId: current.ownerRecordId,
      logicalTarget: current.logicalTarget,
      usage: current.usage as StorageUsage,
    });
    this.assertSupportedOwner(current.ownerRecordType, current.usage);
    input = { ...input, actor: await this.authorizeEvent(current.eventId, input.actor, current.usage as StorageServiceRequest['usage'], 'confirm storage upload') };
    await this.assertCanAccessObject(input.actor, current, 'confirm storage upload');
    if (current.lifecycleState === 'stored') return this.confirmAlreadyStored(current, input);
    if (current.lifecycleState !== 'requested') throw new ConflictException('Only a requested upload can be confirmed');
    this.assertConfirmationDeclaration(current, input);
    const confirmation = await this.confirmWithAdapter(current, input);
    return this.persistStored(current, confirmation, input.context);
  }

  async confirmEventGameLobbyLogoUpload(
    input: StorageServiceConfirmation & { eventId: string },
  ): Promise<PrismStoredObject> {
    const object = await this.database(input.context).opsStoredObject.findUnique({ where: { id: input.objectId } });
    if (!object
      || object.eventId !== input.eventId
      || object.ownerRecordType !== 'event_game_lobby'
      || object.ownerRecordId !== input.eventId
      || object.usage !== 'event_game_branding'
      || !object.logicalTarget.startsWith('lobby-logo:')) {
      throw new NotFoundException('Stored object not found');
    }
    return this.confirmUpload(input);
  }

  async confirmEventGameMediaUpload(input: StorageServiceConfirmation & { eventId: string; gameId: string }): Promise<PrismStoredObject> {
    const object = await this.database(input.context).opsStoredObject.findUnique({ where: { id: input.objectId } });
    if (!object
      || object.eventId !== input.eventId
      || object.ownerRecordType !== 'event_game_definition'
      || object.ownerRecordId !== input.gameId
      || object.usage !== 'event_game_media'
      || !object.logicalTarget.startsWith('game-media:')) {
      throw new NotFoundException('Stored object not found');
    }
    return this.confirmUploadThroughOwnerCapability(input);
  }

  private declaration(input: StorageServiceRequest) {
    return this.validation.validateDeclaration({ fileName: input.fileName, contentType: input.contentType, byteSize: input.declaredByteSize, usage: input.usage, checksumSha256: input.checksumSha256 });
  }

  private adapterRequestForDeclaration(input: StorageServiceRequest, declaration: ReturnType<StorageValidationService['validateDeclaration']>, objectId: string, providerObjectKey: string, existing: OpsStoredObject | null): StorageAdapterRequest {
    return {
      objectId: existing?.id ?? objectId,
      eventId: input.eventId,
      usage: input.usage,
      contentType: declaration.contentType,
      byteSize: declaration.byteSize,
      checksumSha256: declaration.checksumSha256,
      providerObjectKey: existing?.lifecycleState === 'requested' && existing.providerObjectKey ? existing.providerObjectKey : providerObjectKey,
    };
  }

  private async requestLocation(adapterInput: StorageAdapterRequest) {
    try {
      return await this.adapter?.requestUploadLocation(adapterInput) ?? null;
    } catch {
      return null;
    }
  }

  private async recordUnavailable(input: StorageServiceRequest, declaration: ReturnType<StorageValidationService['validateDeclaration']>, objectId: string, providerObjectKey: string, reason = 'Storage provider is not configured'): Promise<StorageRequestResult> {
    const object = this.mapObject(await this.persistFailedRequest(input, declaration, objectId, providerObjectKey, reason, input.context));
    return { status: 'failed', object, reason };
  }

  private async resumeRequest(existing: OpsStoredObject, location: StorageUploadLocation, context?: PrismTransactionContext): Promise<StorageRequestResult> {
    return this.withWritableEventLock(existing.eventId, async (prisma) => {
      const current = await prisma.opsStoredObject.findUnique({ where: { id: existing.id } });
      if (!current) throw new NotFoundException('Stored object not found');
      if (current.lifecycleState === 'stored') return { status: 'stored', object: this.mapObject(current) };
      if (current.lifecycleState === 'requested') {
        if (current.providerObjectKey !== location.providerObjectKey || current.providerName !== location.providerName) {
          throw new ConflictException('Upload request changed while preparing storage authorization; retry');
        }
        return { status: 'ready', object: this.mapObject(current), location };
      }
      if (current.lifecycleState !== 'failed') throw new ConflictException('Only a failed storage request can be resumed');
      const replaced = await prisma.opsStoredObject.update({ where: { id: current.id }, data: { lifecycleState: 'requested', providerName: location.providerName, providerObjectKey: location.providerObjectKey, failureReason: null, failedAt: null, deletedAt: null, requestedAt: new Date() } });
      return { status: 'ready', object: this.mapObject(replaced), location };
    }, context);
  }

  private async createRequest(input: StorageServiceRequest, declaration: ReturnType<StorageValidationService['validateDeclaration']>, objectId: string, location: StorageUploadLocation): Promise<StorageRequestResult> {
    try {
      const object = await this.withWritableEventLock(input.eventId, (lockedPrisma) => lockedPrisma.opsStoredObject.create({
        data: {
          id: objectId, eventId: input.eventId, ownerRecordType: input.ownerRecordType, ownerRecordId: input.ownerRecordId,
          usage: input.usage, logicalTarget: input.logicalTarget, originalFileName: declaration.fileName,
          contentType: declaration.contentType, declaredByteSize: declaration.byteSize, checksumSha256: declaration.checksumSha256,
          uploaderActorId: input.actor.id ?? 'unknown', uploaderActorRole: input.actor.role, lifecycleState: 'requested',
          providerName: location.providerName, providerObjectKey: location.providerObjectKey, idempotencyKey: input.idempotencyKey ?? null,
        },
      }), input.context);
      return { status: 'ready', object: this.mapObject(object), location };
    } catch (error) {
      const race = await this.findExisting(input, input.context);
      if (!race) throw error;
      this.assertSameLogicalContent(race, input, declaration);
      await this.assertCanAccessObject(input.actor, race, 'reuse storage upload');
      if (race.lifecycleState === 'stored') return { status: 'stored', object: this.mapObject(race) };
      const raceLocation = await this.requestLocation(this.adapterRequest(race));
      if (!raceLocation) throw new ServiceUnavailableException('Storage provider could not issue an upload location for the existing object');
      return this.resumeRequest(race, raceLocation, input.context);
    }
  }

  async issueDownloadAuthorization(input: StorageServiceDownload): Promise<PrismStorageDownloadAuthorization> {
    const object = await this.prisma.opsStoredObject.findUnique({ where: { id: input.objectId } });
    if (!object) throw new NotFoundException('Stored object not found');
    if (object.usage === 'event_game_media' || object.usage === 'event_game_branding') {
      throw new ForbiddenException('Event game media requires an approved game access path');
    }
    this.assertSupportedOwner(object.ownerRecordType, object.usage);
    input = { ...input, actor: await this.authorizeEvent(object.eventId, input.actor, object.usage as StorageServiceRequest['usage'], 'download storage object') };
    await this.assertCanAccessObject(input.actor, object, 'download storage object');
    if (object.lifecycleState !== 'stored' || !object.providerObjectKey || !this.adapter) {
      throw new ServiceUnavailableException(object.lifecycleState === 'stored' ? 'Storage provider is not configured' : 'Stored object is not available');
    }
    const authorization = await this.adapter.issueDownloadAuthorization(this.adapterRequest(object));
    return {
      ...authorization,
      expiresAt: authorization.expiresAt.toISOString(),
      fileName: object.originalFileName,
      contentType: object.contentType,
      byteSize: object.declaredByteSize,
    };
  }

  async writeAuthorizedUpload(input: StorageServiceByteUpload): Promise<void> {
    const object = await this.prisma.opsStoredObject.findUnique({ where: { id: input.objectId } });
    if (!object) throw new NotFoundException('Stored object not found');
    input = { ...input, actor: await this.authorizeEvent(object.eventId, input.actor, object.usage as StorageServiceRequest['usage'], 'confirm storage upload') };
    await this.assertCanAccessObject(input.actor, object, 'write storage bytes');
    if (object.lifecycleState !== 'requested') throw new ConflictException('Only a requested upload can receive bytes');
    if (!this.adapter?.writeAuthorizedUpload) throw new ServiceUnavailableException('This storage provider requires a direct HTTP upload');
    const usage = object.usage as StorageServiceRequest['usage'];
    const declaration = this.validation.validateBytes({
      fileName: object.originalFileName,
      contentType: object.contentType,
      byteSize: object.declaredByteSize,
      usage,
      checksumSha256: object.checksumSha256,
    }, input.bytes);
    const validAuthorization = input.uploadUrl.startsWith('localfs://upload/') || input.uploadUrl === `prismapi://upload/${object.id}`;
    if (!validAuthorization) throw new ForbiddenException('Upload authorization is invalid');
    await this.adapter.writeAuthorizedUpload(input.uploadUrl, object.providerObjectKey ?? '', object.contentType, input.bytes);
    // Persist the checksum-bound metadata declaration before the later confirmation call.
    if (declaration.checksumSha256 !== object.checksumSha256) throw new ConflictException('Uploaded bytes do not match the declaration');
  }

  async readAuthorizedDownload(input: StorageServiceByteDownload): Promise<Uint8Array> {
    const object = await this.prisma.opsStoredObject.findUnique({ where: { id: input.objectId } });
    if (!object) throw new NotFoundException('Stored object not found');
    input = { ...input, actor: await this.authorizeEvent(object.eventId, input.actor, object.usage as StorageServiceRequest['usage'], 'download storage object') };
    await this.assertCanAccessObject(input.actor, object, 'download storage object');
    if (object.lifecycleState !== 'stored' || !this.adapter?.readAuthorizedDownload) {
      throw new ServiceUnavailableException(object.lifecycleState === 'stored' ? 'This storage provider requires a direct HTTP download' : 'Stored object is not available');
    }
    if (!input.downloadUrl.startsWith('localfs://download/')) throw new ForbiddenException('Download authorization is invalid');
    const bytes = await this.adapter.readAuthorizedDownload(input.downloadUrl, object.providerObjectKey ?? '');
    this.validation.validateBytes({
      fileName: object.originalFileName,
      contentType: object.contentType,
      byteSize: object.declaredByteSize,
      usage: object.usage as StorageServiceRequest['usage'],
      checksumSha256: object.checksumSha256,
    }, bytes);
    return bytes;
  }

  async validateEventGameMediaReferences(
    input: { eventId: string; gameId: string; objectIds: string[] },
    context?: PrismTransactionContext,
  ): Promise<void> {
    if (input.objectIds.length === 0) return;
    const objectIds = new Set(input.objectIds);
    if (objectIds.size !== input.objectIds.length) {
      throw new NotFoundException('Game media objects are unavailable for this game');
    }

    const objects = await this.database(context).opsStoredObject.findMany({
      where: {
        id: { in: [...objectIds] },
        eventId: input.eventId,
        ownerRecordType: 'event_game_definition',
        ownerRecordId: input.gameId,
        usage: 'event_game_media',
        lifecycleState: 'stored',
      },
    });
    if (objects.length !== objectIds.size) {
      throw new NotFoundException('Game media objects are unavailable for this game');
    }
    for (const object of objects) {
      if (!objectIds.has(object.id)) {
        throw new NotFoundException('Game media objects are unavailable for this game');
      }
      this.assertEventGameMediaObject(object, input);
    }
  }

  async issueEventGameMediaDownloadAuthorization(
    input: { eventId: string; gameId: string; objectId: string },
    context?: PrismTransactionContext,
  ): Promise<PrismEventGameMediaAuthorization> {
    const object = await this.database(context).opsStoredObject.findUnique({
      where: { id: input.objectId },
    });
    if (!object) throw new NotFoundException('Game media objects are unavailable for this game');
    this.assertEventGameMediaObject(object, input);
    if (!this.adapter) throw new ServiceUnavailableException('Storage provider is not configured');

    const authorization = await this.adapter.issueDownloadAuthorization(this.adapterRequest(object));
    return {
      downloadUrl: authorization.downloadUrl,
      expiresAt: authorization.expiresAt.toISOString(),
    };
  }

  async validateEventGameLobbyLogoReference(
    input: { eventId: string; objectId: string },
    context?: PrismTransactionContext,
  ): Promise<void> {
    const object = await this.database(context).opsStoredObject.findUnique({ where: { id: input.objectId } });
    if (!object) throw new NotFoundException('Event lobby logo is unavailable');
    this.assertEventGameLobbyLogoObject(object, input);
  }

  async issueEventGameLobbyLogoDownloadAuthorization(
    input: { eventId: string; objectId: string },
    context?: PrismTransactionContext,
  ): Promise<PrismEventGameMediaAuthorization> {
    const object = await this.database(context).opsStoredObject.findUnique({ where: { id: input.objectId } });
    if (!object) throw new NotFoundException('Event lobby logo is unavailable');
    this.assertEventGameLobbyLogoObject(object, input);
    if (!this.adapter) throw new ServiceUnavailableException('Storage provider is not configured');
    const authorization = await this.adapter.issueDownloadAuthorization(this.adapterRequest(object));
    return { downloadUrl: authorization.downloadUrl, expiresAt: authorization.expiresAt.toISOString() };
  }

  private assertEventGameLobbyLogoObject(
    object: OpsStoredObject,
    scope: { eventId: string; objectId: string },
  ): void {
    const validScope = object.id === scope.objectId
      && object.eventId === scope.eventId
      && object.ownerRecordType === 'event_game_lobby'
      && object.ownerRecordId === scope.eventId
      && object.usage === 'event_game_branding';
    if (!validScope || object.lifecycleState !== 'stored' || Boolean(object.deletedAt) || !object.providerObjectKey) {
      throw new NotFoundException('Event lobby logo is unavailable');
    }
    try {
      this.validation.validateDeclaration({
        fileName: object.originalFileName,
        contentType: object.contentType,
        byteSize: object.declaredByteSize,
        usage: 'event_game_branding',
        checksumSha256: object.checksumSha256,
      });
    } catch {
      throw new NotFoundException('Event lobby logo is unavailable');
    }
  }

  private assertEventGameLobbyLogoOwner(input: Pick<StorageServiceRequest, 'eventId' | 'ownerRecordType' | 'ownerRecordId' | 'logicalTarget' | 'usage'>) {
    if (input.ownerRecordType !== 'event_game_lobby' && input.usage !== 'event_game_branding') return;
    if (input.ownerRecordType !== 'event_game_lobby'
      || input.usage !== 'event_game_branding'
      || input.ownerRecordId !== input.eventId
      || !input.logicalTarget.startsWith('lobby-logo:')) {
      throw new BadRequestException('Lobby logo storage must stay scoped to its event lobby');
    }
  }

  private assertEventGameMediaObject(
    object: OpsStoredObject,
    scope: { eventId: string; gameId: string; objectId?: string },
  ): void {
    if (this.hasInvalidEventGameMediaScope(object, scope) || this.isUnavailableEventGameMedia(object)) {
      throw new NotFoundException('Game media objects are unavailable for this game');
    }
    try {
      this.validation.validateDeclaration({
        fileName: object.originalFileName,
        contentType: object.contentType,
        byteSize: object.declaredByteSize,
        usage: 'event_game_media',
        checksumSha256: object.checksumSha256,
      });
    } catch {
      throw new NotFoundException('Game media objects are unavailable for this game');
    }
  }

  private hasInvalidEventGameMediaScope(
    object: OpsStoredObject,
    scope: { eventId: string; gameId: string; objectId?: string },
  ): boolean {
    const wrongOwner = object.ownerRecordType !== 'event_game_definition' || object.ownerRecordId !== scope.gameId;
    return (scope.objectId !== undefined && object.id !== scope.objectId)
      || object.eventId !== scope.eventId
      || wrongOwner
      || object.usage !== 'event_game_media';
  }

  private isUnavailableEventGameMedia(object: OpsStoredObject): boolean {
    return object.lifecycleState !== 'stored' || Boolean(object.deletedAt) || !object.providerObjectKey;
  }

  /** Returns the event file hub metadata after applying the same event and role policy as downloads. */
  async listEventObjects(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismStoredObject[]> {
    const event = await this.findEvent(eventId);
    await this.requireActorEventScope(actor, eventId, 'list event documents');
    const scopeEvent = await readEventAccessScope(this.prisma, eventId);
    if (!scopeEvent) throw new NotFoundException('Event not found');
    const scoped = scopeActorToEvent(actor, scopeEvent);
    actor = scoped.actor;
    await this.accessPolicy.requireCanReadEvent(actor, event, 'list event documents', scoped.scope);
    const objects = await this.prisma.opsStoredObject.findMany({
      where: { eventId, lifecycleState: { in: ['requested', 'stored', 'failed'] } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return objects
      .filter((object) => this.canSeeObject(actor, object))
      .map((object) => this.mapObject(object));
  }

  private canSeeObject(actor: ResolvedEventOpsActor, object: OpsStoredObject) {
    if (object.usage === 'event_game_media' || object.usage === 'event_game_branding') return false;
    if (!isSupportedStorageOwner(object.ownerRecordType, object.usage)) return false;
    if (actor.role === OpsUserRole.PmcmAdmin || actor.role === OpsUserRole.System) return true;
    return this.canSeeObjectByUsage(actor, object);
  }

  private canSeeObjectByUsage(actor: ResolvedEventOpsActor, object: OpsStoredObject) {
    if (object.usage === 'signed_conforme') return actor.role === OpsUserRole.Client;
    if (object.usage === 'client_document') return actor.role === OpsUserRole.Client || actor.role === OpsUserRole.Coordinator;
    if (object.usage === 'event_deliverable') return actor.role === OpsUserRole.Client || actor.role === OpsUserRole.Coordinator;
    if (object.usage === 'supplier_document') return actor.role === OpsUserRole.Supplier && object.ownerRecordId === actor.supplierId;
    return false;
  }

  private assertSupportedOwner(ownerRecordType: string, usage: string) {
    if (!isSupportedStorageOwner(ownerRecordType, usage)) {
      throw new BadRequestException('Storage owner reference is not supported for this usage');
    }
  }

  private async assertCanAccessObject(actor: ResolvedEventOpsActor, object: OpsStoredObject, resource: string) {
    if (!this.canSeeObject(actor, object)) {
      await this.accessPolicy.recordForbiddenAccess(actor, resource, object.eventId);
      throw new ForbiddenException('Stored object is outside the actor role scope');
    }
  }

  private async assertUploadOwner(input: StorageServiceRequest) {
    if (input.usage === 'supplier_document') await this.assertSupplierUploadOwner(input);
    if (input.usage === 'client_document' || input.usage === 'signed_conforme') await this.assertClientUploadOwner(input);
  }

  private async assertSupplierUploadOwner(input: StorageServiceRequest) {
    const actor = input.actor;
    if (input.ownerRecordType !== 'supplier') throw new BadRequestException('Supplier documents must belong to a supplier');
    const match = /^supplier-(contract|creative):([A-Za-z0-9_-]{1,100}):([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(input.logicalTarget);
    if (!match) throw new ForbiddenException('Supplier document target is outside the verified booking');
    const request = await this.prisma.opsSupplierQuoteRequest.findFirst({
      where: { id: match[2], eventId: input.eventId, supplierId: input.ownerRecordId, status: 'selected', assignmentStatus: 'confirmed' }, select: { id: true },
    });
    if (!request) throw new ForbiddenException('Supplier document target is outside the verified booking');
    await this.assertCreativeTaskOwner(input, match);
    if (actor.role === OpsUserRole.Supplier && (!actor.supplierId || input.ownerRecordId !== actor.supplierId)) {
      await this.accessPolicy.recordForbiddenAccess(actor, 'request supplier document upload', input.eventId);
      throw new ForbiddenException('Supplier documents must belong to the verified supplier');
    }
  }

  private async assertCreativeTaskOwner(input: StorageServiceRequest, match: RegExpExecArray) {
    if (match[1].toLowerCase() !== 'creative') return;
    const task = await this.prisma.opsSupplierCreativeTask.findFirst({
      where: { requestId: match[2], eventId: input.eventId, supplierId: input.ownerRecordId }, select: { id: true },
    });
    if (!task) throw new ForbiddenException('Supplier creative upload is outside the verified task');
  }

  private async assertClientUploadOwner(input: StorageServiceRequest) {
    const target = new RegExp(`^client-upload:${input.eventId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$`, 'i');
    if (input.ownerRecordType === 'event' && input.ownerRecordId === input.eventId && target.test(input.logicalTarget)) return;
    if (input.actor.role === OpsUserRole.Client) await this.accessPolicy.recordForbiddenAccess(input.actor, 'request client document upload', input.eventId);
    throw new ForbiddenException('Client documents must target the current event');
  }

  async deleteObject(input: StorageServiceDeletion): Promise<PrismStoredObject> {
    const prisma = this.database(input.context);
    const object = await prisma.opsStoredObject.findUnique({ where: { id: input.objectId } });
    if (!object) throw new NotFoundException('Stored object not found');
    this.assertSupportedOwner(object.ownerRecordType, object.usage);
    await this.accessPolicy.requireActorRole(input.actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'delete storage object', object.eventId);
    if (object.lifecycleState === 'deleted') return this.mapObject(object);
    if (object.ownerRecordType === 'supplier' && object.usage === 'supplier_document') {
      throw new ConflictException('Supplier workflow evidence is immutable; submit a new version instead');
    }
    if (object.lifecycleState !== 'stored') throw new ConflictException('Only a stored object can be deleted');
    if (!this.adapter) throw new ServiceUnavailableException('Storage provider is not configured');
    await this.adapter.deleteObject({ objectId: object.id, providerObjectKey: object.providerObjectKey ?? '' });
    const updated = await prisma.opsStoredObject.updateMany({
      where: { id: object.id, lifecycleState: 'stored' },
      data: { lifecycleState: 'deleted', deletedAt: new Date() },
    });
    const saved = await prisma.opsStoredObject.findUniqueOrThrow({ where: { id: object.id } });
    if (updated.count !== 1 && saved.lifecycleState !== 'deleted') throw new ConflictException('Storage object state changed; refresh before deleting');
    return this.mapObject(saved);
  }

  private async authorizeEvent(eventId: string, actor: ResolvedEventOpsActor, usage: StorageServiceRequest['usage'], resource: string) {
    await this.requireActorEventScope(actor, eventId, resource);
    const upload = this.isUploadResource(resource);
    if (upload) await this.requireUploadRole(actor, usage, resource, eventId);
    if (!upload && usage === 'supplier_document') await this.requireSupplierDocumentRole(actor, resource, eventId);
    const event = await this.findEvent(eventId);
    if (upload && event.archived) throw new ConflictException('Archived events do not accept file uploads');
    if (this.canSkipEventRead(actor, usage, upload)) return actor;
    const accessScope = await readEventAccessScope(this.prisma, eventId);
    if (!accessScope) throw new NotFoundException('Event not found');
    const scoped = scopeActorToEvent(actor, accessScope);
    await this.accessPolicy.requireCanReadEvent(scoped.actor, event, resource, scoped.scope);
    return scoped.actor;
  }

  private async requireActorEventScope(actor: ResolvedEventOpsActor, eventId: string, resource: string) {
    if (!actor.eventId || actor.eventId === eventId) return;
    await this.accessPolicy.recordForbiddenAccess(actor, resource, eventId);
    throw new ForbiddenException('Storage object is outside the actor event scope');
  }

  private isUploadResource(resource: string) {
    return resource === 'request storage upload' || resource === 'confirm storage upload';
  }

  private async requireUploadRole(actor: ResolvedEventOpsActor, usage: StorageServiceRequest['usage'], resource: string, eventId: string) {
    const roles: Record<StorageServiceRequest['usage'], OpsUserRoleValue[]> = {
      signed_conforme: [OpsUserRole.PmcmAdmin, OpsUserRole.Client],
      client_document: [OpsUserRole.PmcmAdmin, OpsUserRole.Client],
      supplier_document: [OpsUserRole.PmcmAdmin, OpsUserRole.Supplier],
      guest_feedback_media: [OpsUserRole.PmcmAdmin, OpsUserRole.Guest],
      event_deliverable: [OpsUserRole.PmcmAdmin, OpsUserRole.Coordinator, OpsUserRole.System],
      event_game_media: [OpsUserRole.PmcmAdmin, OpsUserRole.Coordinator],
      event_game_branding: [OpsUserRole.PmcmAdmin, OpsUserRole.Coordinator],
    };
    await this.accessPolicy.requireActorRole(actor, roles[usage], resource, eventId);
  }

  private requireSupplierDocumentRole(actor: ResolvedEventOpsActor, resource: string, eventId: string) {
    return this.accessPolicy.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Supplier], resource, eventId);
  }

  private canSkipEventRead(actor: ResolvedEventOpsActor, usage: StorageServiceRequest['usage'], upload: boolean) {
    return (upload && (actor.role === OpsUserRole.PmcmAdmin || actor.role === OpsUserRole.System || (actor.role === OpsUserRole.Guest && usage === 'guest_feedback_media')));
  }

  private async findEvent(eventId: string) {
    if (!this.platformReferences) throw new ServiceUnavailableException('Event access read model is unavailable');
    const event = await this.platformReferences.findStorageEventScope(eventId);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private async persistFailedRequest(input: StorageServiceRequest, declaration: ReturnType<StorageValidationService['validateDeclaration']>, objectId: string, providerObjectKey: string, reason: string, context?: PrismTransactionContext) {
    const prisma = this.database(context);
    const existing = await this.findExisting(input, context);
    if (existing) {
      this.assertSameLogicalContent(existing, input, declaration);
      if (existing.lifecycleState === 'stored') return existing;
      return prisma.opsStoredObject.update({ where: { id: existing.id }, data: { lifecycleState: 'failed', failureReason: reason, failedAt: new Date() } });
    }
    return prisma.opsStoredObject.create({
      data: {
        id: objectId,
        eventId: input.eventId,
        ownerRecordType: input.ownerRecordType,
        ownerRecordId: input.ownerRecordId,
        usage: input.usage,
        logicalTarget: input.logicalTarget,
        originalFileName: declaration.fileName,
        contentType: declaration.contentType,
        declaredByteSize: declaration.byteSize,
        checksumSha256: declaration.checksumSha256,
        uploaderActorId: input.actor.id ?? 'unknown',
        uploaderActorRole: input.actor.role,
        lifecycleState: 'failed',
        providerObjectKey,
        failureReason: reason,
        idempotencyKey: input.idempotencyKey ?? null,
        failedAt: new Date(),
      },
    });
  }

  private async markFailed(id: string, reason: string, context?: PrismTransactionContext) {
    await this.database(context).opsStoredObject.updateMany({ where: { id, lifecycleState: 'requested' }, data: { lifecycleState: 'failed', failureReason: reason, failedAt: new Date() } });
  }

  private confirmAlreadyStored(object: OpsStoredObject, input: StorageServiceConfirmation) {
    this.assertConfirmationDeclaration(object, input, 'Stored object is already bound to different content');
    return this.mapObject(object);
  }

  private assertConfirmationDeclaration(object: OpsStoredObject, input: StorageServiceConfirmation, message = 'Confirmation does not match the upload declaration') {
    if (object.checksumSha256 !== input.checksumSha256.toLowerCase() || object.declaredByteSize !== input.byteSize) throw new ConflictException(message);
  }

  private async confirmWithAdapter(object: OpsStoredObject, input: StorageServiceConfirmation) {
    if (!this.adapter) {
      await this.markFailed(object.id, 'Storage provider is not configured', input.context);
      throw new ServiceUnavailableException('Storage provider is not configured');
    }
    const usage = object.usage as StorageServiceRequest['usage'];
    const declaration = this.validation.validateDeclaration({ fileName: object.originalFileName, contentType: object.contentType, byteSize: object.declaredByteSize, usage, checksumSha256: object.checksumSha256 });
    if (input.bytes) {
      try {
        this.validation.validateBytes({ ...declaration, usage }, input.bytes);
      } catch (error) {
        await this.markFailed(object.id, error instanceof Error ? error.message : 'Uploaded bytes failed validation', input.context);
        throw error;
      }
    }
    const confirmation = await this.adapter.confirmUpload({ objectId: object.id, eventId: object.eventId, usage, contentType: object.contentType, byteSize: object.declaredByteSize, checksumSha256: object.checksumSha256, providerObjectKey: object.providerObjectKey ?? '', bytes: input.bytes });
    if (confirmation.observedBytes) {
      try {
        this.validation.validateBytes({ ...declaration, usage }, confirmation.observedBytes);
      } catch (error) {
        await this.markFailed(object.id, error instanceof Error ? error.message : 'Provider bytes failed validation', input.context);
        throw error;
      }
    }
    if (confirmation.byteSize !== object.declaredByteSize || confirmation.checksumSha256.toLowerCase() !== object.checksumSha256) {
      await this.markFailed(object.id, 'Storage provider returned bytes that do not match the declaration', input.context);
      throw new ConflictException('Storage provider returned bytes that do not match the declaration');
    }
    return confirmation;
  }

  private async persistStored(object: OpsStoredObject, confirmation: { providerName: string; providerObjectKey: string }, context?: PrismTransactionContext) {
    return this.withWritableEventLock(object.eventId, async (prisma) => {
      const updated = await prisma.opsStoredObject.updateMany({ where: { id: object.id, lifecycleState: 'requested', providerObjectKey: object.providerObjectKey }, data: { lifecycleState: 'stored', providerName: confirmation.providerName, providerObjectKey: confirmation.providerObjectKey, storedAt: new Date(), failureReason: null } });
      const saved = await prisma.opsStoredObject.findUniqueOrThrow({ where: { id: object.id } });
      if (updated.count !== 1 && saved.lifecycleState !== 'stored') throw new ConflictException('Storage object state changed; refresh before confirming');
      return this.mapObject(saved);
    }, context);
  }

  private async withWritableEventLock<T>(eventId: string, operation: (prisma: Prisma.TransactionClient) => Promise<T>, context?: PrismTransactionContext): Promise<T> {
    const run = async (prisma: Prisma.TransactionClient) => {
      if (!this.platformReferences) throw new ServiceUnavailableException('Event access read model is unavailable');
      const event = await this.platformReferences.findStorageEventScope(eventId, { prisma, correlationId: `storage-event:${eventId}` });
      if (!event) throw new NotFoundException('Event not found');
      if (event.archived) throw new ConflictException('Archived events do not accept file uploads');
      return operation(prisma);
    };
    if (context) return run(context.prisma);
    return this.prisma.$transaction((tx) => run(tx));
  }

  private findExisting(input: Pick<StorageServiceRequest, 'eventId' | 'usage' | 'logicalTarget' | 'idempotencyKey'>, context?: PrismTransactionContext) {
    if (input.idempotencyKey) return this.database(context).opsStoredObject.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    return this.database(context).opsStoredObject.findUnique({ where: { eventId_usage_logicalTarget: { eventId: input.eventId, usage: input.usage, logicalTarget: input.logicalTarget } } });
  }

  private database(context?: PrismTransactionContext) {
    return context?.prisma ?? this.prisma;
  }

  private assertSameLogicalContent(object: OpsStoredObject, input: StorageServiceRequest, declaration: ReturnType<StorageValidationService['validateDeclaration']>) {
    this.assertSupportedOwner(object.ownerRecordType, object.usage);
    if (!sameUploadOwnerAndActor(object, input) || !sameUploadContent(object, input, declaration)) {
      throw new ConflictException('Storage logical target is already bound to different content');
    }
  }

  private adapterRequest(object: OpsStoredObject): StorageAdapterRequest {
    return {
      objectId: object.id,
      eventId: object.eventId,
      usage: object.usage as StorageServiceRequest['usage'],
      contentType: object.contentType,
      byteSize: object.declaredByteSize,
      checksumSha256: object.checksumSha256,
      providerObjectKey: object.providerObjectKey ?? '',
    };
  }

  private providerObjectKey(eventId: string, usage: string, objectId: string, fileName: string) {
    const extension = fileName.split('.').pop()?.toLowerCase() ?? 'bin';
    return `events/${eventId}/objects/${usage}/${objectId}.${extension}`;
  }

  private mapObject(object: OpsStoredObject): PrismStoredObject {
    return {
      id: object.id,
      eventId: object.eventId,
      ownerRecordType: object.ownerRecordType,
      ownerRecordId: object.ownerRecordId,
      logicalTarget: object.logicalTarget,
      usage: object.usage as PrismStoredObject['usage'],
      originalFileName: object.originalFileName,
      contentType: object.contentType,
      declaredByteSize: object.declaredByteSize,
      checksumSha256: object.checksumSha256,
      uploaderActorId: object.uploaderActorId,
      uploaderActorRole: object.uploaderActorRole,
      lifecycleState: object.lifecycleState as PrismStoredObject['lifecycleState'],
      providerName: object.providerName,
      providerObjectKey: object.providerObjectKey,
      failureReason: object.failureReason,
      requestedAt: object.requestedAt.toISOString(),
      storedAt: object.storedAt?.toISOString() ?? null,
      failedAt: object.failedAt?.toISOString() ?? null,
      deletedAt: object.deletedAt?.toISOString() ?? null,
      createdAt: object.createdAt.toISOString(),
      updatedAt: object.updatedAt.toISOString(),
    };
  }
}
