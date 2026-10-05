import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import type { OpsStoredObject } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole, type OpsUserRole as OpsUserRoleValue } from '@prism/kernel/event-core';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { PrismStoredObject, StorageUsage } from '@prism/types';
import { PLATFORM_REFERENCE_READ_MODEL, type PlatformReferenceReadModel } from '@prism/contexts/read-models';
import {
  STORAGE_ADAPTER,
  type StorageAdapter,
  type StorageAdapterRequest,
  type StorageDownloadAuthorization,
  type StorageRequestResult,
  type StorageServiceConfirmation,
  type StorageServiceDeletion,
  type StorageServiceDownload,
  type StorageServiceRequest,
  type StorageUploadLocation,
} from '../../contracts/storage/storage.port';
import { StorageValidationService } from './storage-validation.service';

export const STORAGE_RETENTION_POLICY_SEAM = 'Retention and legal-hold policy is owned by W29 and is not implemented here';

// Keep the generic storage API closed to owner pairs without production callers.
// This allowlist does not validate target-row existence; each owner capability must do that.
const STORAGE_OWNER_USAGE_REGISTRY: Readonly<Record<string, readonly StorageUsage[]>> = {
  billing_statement: ['event_deliverable'],
};

function isSupportedStorageOwner(ownerRecordType: string, usage: string) {
  return STORAGE_OWNER_USAGE_REGISTRY[ownerRecordType]?.includes(usage as StorageUsage) ?? false;
}

@Injectable()
export class StorageObjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: EventAccessPolicyService,
    private readonly validation: StorageValidationService,
    @Optional() @Inject(STORAGE_ADAPTER) private readonly adapter?: StorageAdapter,
    @Optional() @Inject(PLATFORM_REFERENCE_READ_MODEL) private readonly platformReferences?: PlatformReferenceReadModel,
  ) {}

  async requestUpload(input: StorageServiceRequest): Promise<StorageRequestResult> {
    this.assertSupportedOwner(input.ownerRecordType, input.usage);
    const prisma = this.database(input.context);
    await this.authorizeEvent(input.eventId, input.actor, input.usage, 'request storage upload');
    const declaration = this.declaration(input);
    const objectId = `obj_${randomUUID()}`;
    const providerObjectKey = this.providerObjectKey(input.eventId, input.usage, objectId, declaration.fileName);
    const existing = await this.findExisting(input, input.context);
    if (existing) this.assertSameLogicalContent(existing, input, declaration);
    if (existing?.lifecycleState === 'stored') return { status: 'stored', object: this.mapObject(existing) };
    if (!this.adapter) return this.recordUnavailable(input, declaration, objectId, providerObjectKey);
    const adapterInput = this.adapterRequestForDeclaration(input, declaration, objectId, providerObjectKey, existing);
    const location = await this.requestLocation(adapterInput);
    if (!location) return this.recordUnavailable(input, declaration, objectId, providerObjectKey, 'Storage provider could not issue an upload location');
    if (existing) return this.resumeRequest(prisma, existing, location);
    return this.createRequest(prisma, input, declaration, objectId, location);
  }

  async confirmUpload(input: StorageServiceConfirmation): Promise<PrismStoredObject> {
    const prisma = this.database(input.context);
    const current = await prisma.opsStoredObject.findUnique({ where: { id: input.objectId } });
    if (!current) throw new NotFoundException('Stored object not found');
    this.assertSupportedOwner(current.ownerRecordType, current.usage);
    await this.authorizeEvent(current.eventId, input.actor, current.usage as StorageServiceRequest['usage'], 'confirm storage upload');
    if (current.lifecycleState === 'stored') return this.confirmAlreadyStored(current, input);
    if (current.lifecycleState !== 'requested') throw new ConflictException('Only a requested upload can be confirmed');
    this.assertConfirmationDeclaration(current, input);
    const confirmation = await this.confirmWithAdapter(current, input);
    return this.persistStored(current, confirmation, prisma);
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

  private async resumeRequest(prisma: ReturnType<StorageObjectService['database']>, existing: OpsStoredObject, location: StorageUploadLocation): Promise<StorageRequestResult> {
    if (existing.lifecycleState === 'requested') return { status: 'ready', object: this.mapObject(existing), location };
    const replaced = await prisma.opsStoredObject.update({ where: { id: existing.id }, data: { lifecycleState: 'requested', providerName: location.providerName, providerObjectKey: location.providerObjectKey, failureReason: null, failedAt: null, deletedAt: null, requestedAt: new Date() } });
    return { status: 'ready', object: this.mapObject(replaced), location };
  }

  private async createRequest(prisma: ReturnType<StorageObjectService['database']>, input: StorageServiceRequest, declaration: ReturnType<StorageValidationService['validateDeclaration']>, objectId: string, location: StorageUploadLocation): Promise<StorageRequestResult> {
    try {
      const object = await prisma.opsStoredObject.create({ data: { id: objectId, eventId: input.eventId, ownerRecordType: input.ownerRecordType, ownerRecordId: input.ownerRecordId, usage: input.usage, logicalTarget: input.logicalTarget, originalFileName: declaration.fileName, contentType: declaration.contentType, declaredByteSize: declaration.byteSize, checksumSha256: declaration.checksumSha256, uploaderActorId: input.actor.id ?? 'unknown', uploaderActorRole: input.actor.role, lifecycleState: 'requested', providerName: location.providerName, providerObjectKey: location.providerObjectKey, idempotencyKey: input.idempotencyKey ?? null } });
      return { status: 'ready', object: this.mapObject(object), location };
    } catch (error) {
      const race = await this.findExisting(input, input.context);
      if (!race) throw error;
      this.assertSameLogicalContent(race, input, declaration);
      if (race.lifecycleState === 'stored') return { status: 'stored', object: this.mapObject(race) };
      return { status: 'ready', object: this.mapObject(race), location };
    }
  }

  async issueDownloadAuthorization(input: StorageServiceDownload): Promise<StorageDownloadAuthorization> {
    const object = await this.prisma.opsStoredObject.findUnique({ where: { id: input.objectId } });
    if (!object) throw new NotFoundException('Stored object not found');
    this.assertSupportedOwner(object.ownerRecordType, object.usage);
    await this.authorizeEvent(object.eventId, input.actor, object.usage as StorageServiceRequest['usage'], 'download storage object');
    if (object.lifecycleState !== 'stored' || !object.providerObjectKey || !this.adapter) {
      throw new ServiceUnavailableException(object.lifecycleState === 'stored' ? 'Storage provider is not configured' : 'Stored object is not available');
    }
    return this.adapter.issueDownloadAuthorization(this.adapterRequest(object));
  }

  /** Returns the event file hub metadata after applying the same event and role policy as downloads. */
  async listEventObjects(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismStoredObject[]> {
    const event = await this.findEvent(eventId);
    await this.requireActorEventScope(actor, eventId, 'list event documents');
    await this.accessPolicy.requireCanReadEvent(actor, event, 'list event documents', {
      supplierEventIds: this.supplierEventScope(actor, event.id, event.supplierIds),
    });
    const objects = await this.prisma.opsStoredObject.findMany({
      where: { eventId, lifecycleState: { in: ['requested', 'stored', 'failed'] } },
      orderBy: { createdAt: 'desc' },
    });
    return objects
      .filter((object) => this.canSeeObject(actor, object))
      .map((object) => this.mapObject(object));
  }

  private canSeeObject(actor: ResolvedEventOpsActor, object: OpsStoredObject) {
    if (!isSupportedStorageOwner(object.ownerRecordType, object.usage)) return false;
    if (actor.role === OpsUserRole.PmcmAdmin || actor.role === OpsUserRole.System) return true;
    if (object.usage === 'signed_conforme') return actor.role === OpsUserRole.Client;
    if (object.usage === 'event_deliverable') return actor.role === OpsUserRole.Client || actor.role === OpsUserRole.Coordinator;
    if (object.usage === 'supplier_document') return actor.role === OpsUserRole.Supplier && object.ownerRecordId === actor.supplierId;
    return false;
  }

  private assertSupportedOwner(ownerRecordType: string, usage: string) {
    if (!isSupportedStorageOwner(ownerRecordType, usage)) {
      throw new BadRequestException('Storage owner reference is not supported for this usage');
    }
  }

  async deleteObject(input: StorageServiceDeletion): Promise<PrismStoredObject> {
    const prisma = this.database(input.context);
    const object = await prisma.opsStoredObject.findUnique({ where: { id: input.objectId } });
    if (!object) throw new NotFoundException('Stored object not found');
    this.assertSupportedOwner(object.ownerRecordType, object.usage);
    await this.accessPolicy.requireActorRole(input.actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'delete storage object', object.eventId);
    if (object.lifecycleState === 'deleted') return this.mapObject(object);
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
    if (this.canSkipEventRead(actor, usage, upload)) return;
    await this.accessPolicy.requireCanReadEvent(actor, event, resource, { supplierEventIds: this.supplierEventScope(actor, event.id, event.supplierIds) });
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
      supplier_document: [OpsUserRole.PmcmAdmin, OpsUserRole.Supplier],
      guest_feedback_media: [OpsUserRole.PmcmAdmin, OpsUserRole.Guest],
      event_deliverable: [OpsUserRole.PmcmAdmin, OpsUserRole.Coordinator, OpsUserRole.System],
    };
    await this.accessPolicy.requireActorRole(actor, roles[usage], resource, eventId);
  }

  private requireSupplierDocumentRole(actor: ResolvedEventOpsActor, resource: string, eventId: string) {
    return this.accessPolicy.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Supplier], resource, eventId);
  }

  private canSkipEventRead(actor: ResolvedEventOpsActor, usage: StorageServiceRequest['usage'], upload: boolean) {
    return (upload && (actor.role === OpsUserRole.PmcmAdmin || actor.role === OpsUserRole.System || (actor.role === OpsUserRole.Guest && usage === 'guest_feedback_media')));
  }

  private supplierEventScope(actor: ResolvedEventOpsActor, eventId: string, supplierIds: string[]) {
    return actor.supplierId && supplierIds.includes(actor.supplierId) ? [eventId] : [];
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
    if (confirmation.byteSize !== object.declaredByteSize || confirmation.checksumSha256.toLowerCase() !== object.checksumSha256) {
      await this.markFailed(object.id, 'Storage provider returned bytes that do not match the declaration', input.context);
      throw new ConflictException('Storage provider returned bytes that do not match the declaration');
    }
    return confirmation;
  }

  private async persistStored(object: OpsStoredObject, confirmation: { providerName: string; providerObjectKey: string }, prisma: ReturnType<StorageObjectService['database']>) {
    const updated = await prisma.opsStoredObject.updateMany({ where: { id: object.id, lifecycleState: 'requested' }, data: { lifecycleState: 'stored', providerName: confirmation.providerName, providerObjectKey: confirmation.providerObjectKey, storedAt: new Date(), failureReason: null } });
    const saved = await prisma.opsStoredObject.findUniqueOrThrow({ where: { id: object.id } });
    if (updated.count !== 1 && saved.lifecycleState !== 'stored') throw new ConflictException('Storage object state changed; refresh before confirming');
    return this.mapObject(saved);
  }

  private findExisting(input: Pick<StorageServiceRequest, 'eventId' | 'usage' | 'logicalTarget' | 'idempotencyKey'>, context?: PrismTransactionContext) {
    if (input.idempotencyKey) return this.database(context).opsStoredObject.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    return this.database(context).opsStoredObject.findUnique({ where: { eventId_usage_logicalTarget: { eventId: input.eventId, usage: input.usage, logicalTarget: input.logicalTarget } } });
  }

  private database(context?: PrismTransactionContext) {
    return context?.prisma ?? this.prisma;
  }

  private assertSameLogicalContent(object: OpsStoredObject, input: StorageServiceRequest, declaration: ReturnType<StorageValidationService['validateDeclaration']>) {
    if (object.eventId !== input.eventId || object.usage !== input.usage || object.logicalTarget !== input.logicalTarget || object.contentType !== declaration.contentType || object.declaredByteSize !== declaration.byteSize || object.checksumSha256 !== declaration.checksumSha256) {
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
