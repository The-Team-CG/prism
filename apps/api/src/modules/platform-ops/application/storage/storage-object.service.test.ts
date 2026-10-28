import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalFileSystemStorageAdapter } from '../../infrastructure/storage/local-filesystem-storage.adapter';
import { StorageObjectService } from './storage-object.service';
import { StorageValidationService } from './storage-validation.service';

const actorSnapshot = { id: 'user_pmcm', role: 'pmcm-admin', name: 'PMCM Admin', explicit: true, verified: true };
const actor = actorSnapshot as never;
const client = { id: 'user_client', role: 'client', email: 'client@example.test', name: 'Client', eventId: 'evt_1', explicit: true, verified: true } as never;

function createStore() {
  const objects: Array<Record<string, any>> = [];
  const statements: Array<{ id: string; sentAt: Date | null }> = [];
  const bookings = [{ id: 'req_1', eventId: 'evt_1', supplierId: 'sup_1', status: 'selected', assignmentStatus: 'confirmed' }];
  const now = () => new Date('2026-09-08T00:00:00.000Z');
  const prisma = {
    opsStoredObject: {
      findUnique: vi.fn(async ({ where }: { where: Record<string, any> }) => {
        if (where.id) return objects.find((object) => object.id === where.id) ?? null;
        if (where.idempotencyKey) return objects.find((object) => object.idempotencyKey === where.idempotencyKey) ?? null;
        const target = where.eventId_usage_logicalTarget;
        return objects.find((object) => object.eventId === target.eventId && object.usage === target.usage && object.logicalTarget === target.logicalTarget) ?? null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
        const object = { ...data, providerName: data.providerName ?? null, createdAt: now(), updatedAt: now(), requestedAt: data.requestedAt ?? now(), storedAt: null, failedAt: data.failedAt ?? null, deletedAt: null };
        objects.push(object);
        return object;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, any> }) => {
        const object = objects.find((candidate) => candidate.id === where.id);
        if (!object) throw new Error('object missing');
        Object.assign(object, data, { updatedAt: now() });
        return object;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
        const object = objects.find((candidate) => Object.entries(where).every(([key, value]) => candidate[key] === value));
        if (!object) return { count: 0 };
        Object.assign(object, data, { updatedAt: now() });
        return { count: 1 };
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const object = objects.find((candidate) => candidate.id === where.id);
        if (!object) throw new Error('object missing');
        return object;
      }),
      findMany: vi.fn(async ({ where }: { where: { eventId: string } }) => objects.filter((object) => object.eventId === where.eventId)),
    },
    opsEvent: {
      findUnique: vi.fn(async () => ({ id: 'evt_1', archived: false, clientName: 'Client', clientPortalStatus: 'unlocked', inquiry: { email: 'client@example.test' }, supplierQuoteRequests: [] as Array<{ supplierId: string; supplier: { email: string } }> })),
    },
    opsBillingStatement: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] }; sentAt: null } }) => statements.filter((statement) => where.id.in.includes(statement.id) && statement.sentAt === null)),
    },
    opsSupplierQuoteRequest: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, string> }) => bookings.find((booking) => Object.entries(where).every(([key, value]) => booking[key as keyof typeof booking] === value)) ?? null),
    },
    opsSupplierCreativeTask: { findFirst: vi.fn(async () => ({ id: 'task_1' })) },
    $queryRaw: vi.fn(async () => [{ id: 'evt_1' }]),
    $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work(prisma)),
  };
  const accessPolicy = {
    requireActorRole: vi.fn(async (candidate: { role: string }, roles: readonly string[], resource: string) => {
      if (!roles.includes(candidate.role)) throw new ForbiddenException(`${candidate.role} cannot access ${resource}`);
    }),
    requireCanReadEvent: vi.fn(async () => undefined),
    recordForbiddenAccess: vi.fn(async () => undefined),
  };
  const requirementVisibility: Record<string, string[]> = {};
  const platformReferences = {
    findStorageEventScope: vi.fn(async (eventId: string) => eventId === 'evt_1' ? ({
      id: 'evt_1', archived: false, clientName: 'Client', clientPortalStatus: 'unlocked', clientEmail: 'client@example.test', supplierIds: [] as string[], supplierContacts: [] as Array<{ supplierId: string; email: string | null }>,
    }) : null),
    findFileRequirementVisibility: vi.fn(async () => requirementVisibility),
  };
  const auditWriter = { write: vi.fn(async (_input: Record<string, any>) => undefined) };
  return {
    objects,
    statements,
    bookings,
    prisma,
    accessPolicy,
    platformReferences,
    auditWriter,
    requirementVisibility,
    service: new StorageObjectService(prisma as never, accessPolicy as never, new StorageValidationService(), undefined, platformReferences as never, auditWriter as never),
  };
}

const bytes = Buffer.from('%PDF-1.7\nprovider-neutral storage bytes');
const checksumSha256 = createHash('sha256').update(bytes).digest('hex');
const request = {
  eventId: 'evt_1', ownerRecordType: 'billing_statement', ownerRecordId: 'bill_1', logicalTarget: 'billing-statement:bill_1', usage: 'event_deliverable' as const,
  fileName: 'signed.pdf', contentType: 'application/pdf', declaredByteSize: bytes.byteLength, checksumSha256,
};

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe('StorageObjectService', () => {
  it('returns a scoped lobby logo upload ticket without exposing storage metadata', async () => {
    const store = createStore();
    const adapter = {
      requestUploadLocation: vi.fn(async (input: { providerObjectKey: string }) => ({
        providerName: 'test',
        providerObjectKey: input.providerObjectKey,
        uploadUrl: 'https://storage.example.test/upload-token',
        expiresAt: new Date('2026-09-08T00:05:00.000Z'),
      })),
      confirmUpload: vi.fn(),
      issueDownloadAuthorization: vi.fn(),
      deleteObject: vi.fn(),
    };
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter as never, store.platformReferences as never);

    const result = await service.requestEventGameLobbyLogoUpload({
      eventId: 'evt_1',
      ownerRecordType: 'event_game_lobby',
      ownerRecordId: 'evt_1',
      logicalTarget: 'lobby-logo:key-1',
      usage: 'event_game_branding',
      fileName: 'logo.png',
      contentType: 'image/png',
      declaredByteSize: 3,
      checksumSha256: createHash('sha256').update('png').digest('hex'),
      idempotencyKey: 'lobby-logo-key-1',
      actor,
    });

    expect(result).toEqual({
      objectId: expect.stringMatching(/^obj_[\da-f-]{36}$/i),
      uploadUrl: 'https://storage.example.test/upload-token',
      expiresAt: '2026-09-08T00:05:00.000Z',
      alreadyStored: false,
    });
    expect(JSON.stringify(result)).not.toContain('providerObjectKey');
    expect(store.objects[0]).toMatchObject({ ownerRecordType: 'event_game_lobby', ownerRecordId: 'evt_1', usage: 'event_game_branding' });
  });

  it('issues game-media upload tickets only through the game-scoped storage capability', async () => {
    const store = createStore();
    const adapter = {
      requestUploadLocation: vi.fn(async (input: { providerObjectKey: string }) => ({
        providerName: 'test', providerObjectKey: input.providerObjectKey,
        uploadUrl: 'https://storage.example.test/game-upload', expiresAt: new Date('2026-09-08T00:05:00.000Z'),
      })),
      confirmUpload: vi.fn(), issueDownloadAuthorization: vi.fn(), deleteObject: vi.fn(),
    };
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter as never, store.platformReferences as never);
    const request = {
      eventId: 'evt_1', gameId: 'game-1', fileName: 'clue.png', contentType: 'image/png',
      declaredByteSize: 3, checksumSha256: createHash('sha256').update('png').digest('hex'),
      idempotencyKey: '00000000-0000-4000-8000-000000000002', actor,
    };

    const result = await service.requestEventGameMediaUpload(request);

    expect(result).toMatchObject({
      objectId: expect.stringMatching(/^obj_[\da-f-]{36}$/i),
      uploadUrl: 'https://storage.example.test/game-upload', alreadyStored: false,
    });
    expect(store.objects[0]).toMatchObject({
      eventId: 'evt_1', ownerRecordType: 'event_game_definition', ownerRecordId: 'game-1',
      usage: 'event_game_media', logicalTarget: 'game-media:game-1:00000000-0000-4000-8000-000000000002',
    });
    await expect(service.requestUpload({
      ...request, ownerRecordType: 'event_game_definition', ownerRecordId: 'game-1',
      logicalTarget: 'game-media:generic-route', usage: 'event_game_media',
    })).rejects.toThrow(/game-scoped route/i);
  });

  it('does not confirm game media through a different game route', async () => {
    const store = createStore();
    store.objects.push({
      id: 'obj_1f0c48e6-2d74-43ec-b5dd-e3a62b8ec444', eventId: 'evt_1',
      ownerRecordType: 'event_game_definition', ownerRecordId: 'game-a', usage: 'event_game_media',
      logicalTarget: 'game-media:key', lifecycleState: 'requested', checksumSha256,
      declaredByteSize: bytes.byteLength, originalFileName: 'clue.png', contentType: 'image/png',
      providerObjectKey: 'events/evt_1/objects/event_game_media/clue.png',
    });
    const adapter = { confirmUpload: vi.fn() };

    await expect(store.service.confirmEventGameMediaUpload({
      eventId: 'evt_1', gameId: 'game-b', objectId: 'obj_1f0c48e6-2d74-43ec-b5dd-e3a62b8ec444',
      checksumSha256, byteSize: bytes.byteLength, actor,
    })).rejects.toThrow(/not found/i);
    expect(adapter.confirmUpload).not.toHaveBeenCalled();
  });

  it('fails closed when lobby logo storage cannot issue an upload ticket', async () => {
    const store = createStore();
    await expect(store.service.requestEventGameLobbyLogoUpload({
      eventId: 'evt_1',
      ownerRecordType: 'event_game_lobby',
      ownerRecordId: 'evt_1',
      logicalTarget: 'lobby-logo:key-2',
      usage: 'event_game_branding',
      fileName: 'logo.png',
      contentType: 'image/png',
      declaredByteSize: 3,
      checksumSha256: createHash('sha256').update('png').digest('hex'),
      idempotencyKey: 'lobby-logo-key-2',
      actor,
    })).rejects.toThrow(/lobby logo storage is not available/i);
  });

  it('does not confirm a lobby logo through a different event route', async () => {
    const store = createStore();
    store.objects.push({
      id: 'obj_1f0c48e6-2d74-43ec-b5dd-e3a62b8ec444',
      eventId: 'evt_other',
      ownerRecordType: 'event_game_lobby',
      ownerRecordId: 'evt_other',
      usage: 'event_game_branding',
      logicalTarget: 'lobby-logo:key',
      lifecycleState: 'requested',
      checksumSha256,
      declaredByteSize: bytes.byteLength,
      originalFileName: 'logo.png',
      contentType: 'image/png',
      providerObjectKey: 'events/evt_other/objects/event_game_branding/logo.png',
    });
    const adapter = { confirmUpload: vi.fn() };
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter as never, store.platformReferences as never);

    await expect(service.confirmEventGameLobbyLogoUpload({
      eventId: 'evt_1',
      objectId: 'obj_1f0c48e6-2d74-43ec-b5dd-e3a62b8ec444',
      checksumSha256,
      byteSize: bytes.byteLength,
      actor,
    })).rejects.toThrow(/not found/i);
    expect(adapter.confirmUpload).not.toHaveBeenCalled();
  });

  it('records an explicit failed request and no success when no provider is configured', async () => {
    const { service, objects } = createStore();
    const result = await service.requestUpload({ ...request, actor });
    expect(result).toMatchObject({ status: 'failed', reason: 'Storage provider is not configured' });
    expect(objects[0]).toMatchObject({ lifecycleState: 'failed', failureReason: 'Storage provider is not configured', providerName: null });
    expect('location' in result).toBe(false);
  });

  it('rejects new storage work for an event that no longer resolves', async () => {
    const store = createStore();
    store.platformReferences.findStorageEventScope.mockResolvedValueOnce(null);

    await expect(store.service.requestUpload({ ...request, actor })).rejects.toThrow(/Event not found/);
    expect(store.prisma.opsStoredObject.create).not.toHaveBeenCalled();
  });

  it('rejects an unwired owner and usage before provider access, authorization, or persistence', async () => {
    const store = createStore();
    const adapter = {
      requestUploadLocation: vi.fn(async (input: { providerObjectKey: string }) => ({ providerName: 'test', providerObjectKey: input.providerObjectKey, uploadUrl: 'test://upload', expiresAt: new Date(Date.now() + 1000) })),
      confirmUpload: vi.fn(),
      issueDownloadAuthorization: vi.fn(),
      deleteObject: vi.fn(),
    };
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter, store.platformReferences as never);

    await expect(service.requestUpload({
      ...request,
      ownerRecordType: 'conforme',
      ownerRecordId: 'conforme_1',
      logicalTarget: 'signed-conforme',
      usage: 'signed_conforme',
      actor,
    })).rejects.toThrow(/owner reference is not supported/);

    expect(store.prisma.opsStoredObject.findUnique).not.toHaveBeenCalled();
    expect(store.prisma.opsStoredObject.create).not.toHaveBeenCalled();
    expect(store.platformReferences.findStorageEventScope).not.toHaveBeenCalled();
    expect(store.accessPolicy.requireActorRole).not.toHaveBeenCalled();
  });

  it('rejects writes to an archived event before requesting provider authorization', async () => {
    const store = createStore();
    store.platformReferences.findStorageEventScope.mockResolvedValue({
      id: 'evt_1', archived: true, clientName: 'Client', clientPortalStatus: 'unlocked', clientEmail: 'client@example.test', supplierIds: [], supplierContacts: [],
    });
    const adapter = { requestUploadLocation: vi.fn(), confirmUpload: vi.fn(), issueDownloadAuthorization: vi.fn(), deleteObject: vi.fn() };
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter, store.platformReferences as never);
    await expect(service.requestUpload({ ...request, actor })).rejects.toThrow(/Archived events/);
    expect(adapter.requestUploadLocation).not.toHaveBeenCalled();
  });

  it('round-trips bytes through the configured local adapter and marks deletion', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prism-storage-service-'));
    roots.push(root);
    const adapter = new LocalFileSystemStorageAdapter(root);
    const store = createStore();
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter, store.platformReferences as never);
    const requested = await service.requestUpload({ ...request, actor });
    expect(requested.status).toBe('ready');
    if (requested.status !== 'ready') throw new Error('expected upload location');
    await service.writeAuthorizedUpload({ objectId: requested.object.id, uploadUrl: requested.location.uploadUrl, bytes, actor });
    const stored = await service.confirmUpload({ objectId: requested.object.id, byteSize: bytes.byteLength, checksumSha256, actor });
    expect(stored).toMatchObject({ lifecycleState: 'stored', providerName: 'local-filesystem-development' });
    const authorization = await service.issueDownloadAuthorization({ objectId: stored.id, actor });
    await expect(adapter.readBytes(authorization.downloadUrl)).resolves.toEqual(bytes);
    await expect(service.deleteObject({ objectId: stored.id, actor })).resolves.toMatchObject({ lifecycleState: 'deleted' });
  });

  it('keeps supplier workflow evidence immutable through generic deletion', async () => {
    const store = createStore();
    const adapter = { requestUploadLocation: vi.fn(), confirmUpload: vi.fn(), issueDownloadAuthorization: vi.fn(), deleteObject: vi.fn() };
    store.objects.push({
      id: 'obj_supplier_evidence', eventId: 'evt_1', ownerRecordType: 'supplier', ownerRecordId: 'supplier_1',
      logicalTarget: 'supplier-contract:req_1:123e4567-e89b-12d3-a456-426614174000', usage: 'supplier_document',
      lifecycleState: 'stored', providerName: 'test', providerObjectKey: 'supplier/evidence.pdf', originalFileName: 'evidence.pdf',
      contentType: 'application/pdf', declaredByteSize: bytes.byteLength, checksumSha256, uploaderActorId: 'user_supplier',
      uploaderActorRole: 'supplier', createdAt: new Date(), updatedAt: new Date(), requestedAt: new Date(), storedAt: new Date(),
      failedAt: null, deletedAt: null, idempotencyKey: null, failureReason: null,
    });
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter, store.platformReferences as never);
    await expect(service.deleteObject({ objectId: 'obj_supplier_evidence', actor })).rejects.toBeInstanceOf(ConflictException);
    expect(adapter.deleteObject).not.toHaveBeenCalled();
    expect(store.objects[0].lifecycleState).toBe('stored');
  });

  it('keeps a logical target idempotent and rejects changed content', async () => {
    const store = createStore();
    const adapter = { requestUploadLocation: vi.fn(async (input: { providerObjectKey: string }) => ({ providerName: 'test', providerObjectKey: input.providerObjectKey, uploadUrl: 'test://upload', expiresAt: new Date(Date.now() + 1000) })), confirmUpload: vi.fn(), issueDownloadAuthorization: vi.fn(), deleteObject: vi.fn() };
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter, store.platformReferences as never);
    const first = await service.requestUpload({ ...request, actor });
    const second = await service.requestUpload({ ...request, actor });
    expect(second).toMatchObject({ status: 'ready', object: { id: first.status === 'ready' ? first.object.id : undefined } });
    await expect(service.requestUpload({ ...request, checksumSha256: 'b'.repeat(64), actor })).rejects.toThrow(/different content/);
  });

  it('rejects an existing legacy owner pair before requesting a provider location', async () => {
    const store = createStore();
    const adapter = { requestUploadLocation: vi.fn(async (input: { providerObjectKey: string }) => ({ providerName: 'test', providerObjectKey: input.providerObjectKey, uploadUrl: 'test://upload', expiresAt: new Date(Date.now() + 1000) })) };
    store.objects.push({ id: 'obj_legacy', ...request, ownerRecordType: 'conforme', ownerRecordId: 'conforme_1', lifecycleState: 'failed' });
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter as never, store.platformReferences as never);

    await expect(service.requestUpload({ ...request, actor })).rejects.toThrow(/owner reference is not supported/);
    expect(adapter.requestUploadLocation).not.toHaveBeenCalled();
    expect(store.prisma.opsStoredObject.create).not.toHaveBeenCalled();
  });

  it('rejects a global idempotency-key match bound to a different owner record before provider access', async () => {
    const store = createStore();
    const adapter = { requestUploadLocation: vi.fn(async (input: { providerObjectKey: string }) => ({ providerName: 'test', providerObjectKey: input.providerObjectKey, uploadUrl: 'test://upload', expiresAt: new Date(Date.now() + 1000) })) };
    store.objects.push({ id: 'obj_other_owner', ...request, ownerRecordId: 'bill_other', idempotencyKey: 'global-key', lifecycleState: 'failed' });
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter as never, store.platformReferences as never);

    await expect(service.requestUpload({ ...request, idempotencyKey: 'global-key', actor })).rejects.toThrow(/different content/);
    expect(adapter.requestUploadLocation).not.toHaveBeenCalled();
    expect(store.prisma.opsStoredObject.create).not.toHaveBeenCalled();
  });

  it('rejects an unsupported owner recovered after a unique-key race', async () => {
    const store = createStore();
    const adapter = { requestUploadLocation: vi.fn(async (input: { providerObjectKey: string }) => ({ providerName: 'test', providerObjectKey: input.providerObjectKey, uploadUrl: 'test://upload', expiresAt: new Date(Date.now() + 1000) })) };
    const raced = { id: 'obj_raced', ...request, ownerRecordType: 'conforme', ownerRecordId: 'conforme_1', idempotencyKey: 'race-key', lifecycleState: 'failed' };
    store.prisma.opsStoredObject.findUnique.mockImplementation(async ({ where }: { where: Record<string, any> }) => {
      if (where.idempotencyKey === 'race-key') return store.prisma.opsStoredObject.create.mock.calls.length > 0 ? raced : null;
      if (where.id) return store.objects.find((object) => object.id === where.id) ?? null;
      const target = where.eventId_usage_logicalTarget;
      return store.objects.find((object) => object.eventId === target.eventId && object.usage === target.usage && object.logicalTarget === target.logicalTarget) ?? null;
    });
    store.prisma.opsStoredObject.create.mockRejectedValueOnce(new Error('unique constraint'));
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter as never, store.platformReferences as never);

    await expect(service.requestUpload({ ...request, idempotencyKey: 'race-key', actor })).rejects.toThrow(/owner reference is not supported/);
    expect(adapter.requestUploadLocation).toHaveBeenCalledOnce();
  });

  it('rejects confirmation metadata that differs from the request declaration', async () => {
    const store = createStore();
    const adapter = { requestUploadLocation: vi.fn(async (input: { providerObjectKey: string }) => ({ providerName: 'test', providerObjectKey: input.providerObjectKey, uploadUrl: 'test://upload', expiresAt: new Date(Date.now() + 1000) })), confirmUpload: vi.fn(), issueDownloadAuthorization: vi.fn(), deleteObject: vi.fn() };
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter, store.platformReferences as never);
    const requested = await service.requestUpload({ ...request, actor });
    if (requested.status !== 'ready') throw new Error('expected upload location');
    await expect(service.confirmUpload({ objectId: requested.object.id, byteSize: bytes.byteLength, checksumSha256: 'c'.repeat(64), actor })).rejects.toThrow(/does not match/);
    expect(store.objects[0].lifecycleState).toBe('requested');
  });

  it('marks provider bytes failed when actual file signature does not match the declared PDF type', async () => {
    const store = createStore();
    const invalidPdf = Buffer.from('not a PDF payload');
    const invalidChecksum = createHash('sha256').update(invalidPdf).digest('hex');
    const root = await mkdtemp(join(tmpdir(), 'prism-storage-invalid-'));
    roots.push(root);
    const adapter = new LocalFileSystemStorageAdapter(root);
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter, store.platformReferences as never);
    const requested = await service.requestUpload({ ...request, declaredByteSize: invalidPdf.byteLength, checksumSha256: invalidChecksum, actor });
    if (requested.status !== 'ready') throw new Error('expected upload location');
    await expect(service.confirmUpload({ objectId: requested.object.id, byteSize: invalidPdf.byteLength, checksumSha256: invalidChecksum, bytes: invalidPdf, actor })).rejects.toThrow(/file type/);
    expect(store.objects[0].lifecycleState).toBe('failed');
  });

  it('denies a client downloading an object outside the actor event scope', async () => {
    const store = createStore();
    store.objects.push({ id: 'obj_other', eventId: 'evt_other', ownerRecordType: 'billing_statement', ownerRecordId: 'bill_other', usage: 'event_deliverable', lifecycleState: 'stored', providerObjectKey: 'events/evt_other/obj.pdf', contentType: 'application/pdf', declaredByteSize: 1, checksumSha256: 'a'.repeat(64), originalFileName: 'obj.pdf' });
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), {} as never, store.platformReferences as never);
    await expect(service.issueDownloadAuthorization({ objectId: 'obj_other', actor: client })).rejects.toThrow(/outside|forbidden|scope/);
  });

  it('refuses a client download of a billing statement PMCM hid from clients, and still allows PMCM', async () => {
    const store = createStore();
    store.requirementVisibility.billing_statement = ['pmcm-admin', 'coordinator'];
    store.objects.push({ id: 'obj_billing', eventId: 'evt_1', ownerRecordType: 'billing_statement', ownerRecordId: 'bill_1', usage: 'event_deliverable', lifecycleState: 'stored', providerName: 'test', providerObjectKey: 'events/evt_1/billing.pdf', contentType: 'application/pdf', declaredByteSize: 1, checksumSha256: 'a'.repeat(64), originalFileName: 'billing.pdf' });
    const adapter = { issueDownloadAuthorization: vi.fn(async () => ({ downloadUrl: 'https://storage.example.test/signed-billing', expiresAt: new Date('2026-10-20T00:00:00.000Z') })) };
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter as never, store.platformReferences as never, store.auditWriter as never);

    await expect(service.issueDownloadAuthorization({ objectId: 'obj_billing', actor: client })).rejects.toBeInstanceOf(ForbiddenException);
    expect(adapter.issueDownloadAuthorization).not.toHaveBeenCalled();

    await expect(service.issueDownloadAuthorization({ objectId: 'obj_billing', actor })).resolves.toMatchObject({ downloadUrl: 'https://storage.example.test/signed-billing' });
  });

  it('keeps a billing statement file from the client until PMCM sends the statement', async () => {
    const store = createStore();
    store.statements.push({ id: 'bill_1', sentAt: null });
    const at = new Date('2026-10-19T00:00:00.000Z');
    store.objects.push({ createdAt: at, updatedAt: at, requestedAt: at, storedAt: at, id: 'obj_billing', eventId: 'evt_1', ownerRecordType: 'billing_statement', ownerRecordId: 'bill_1', usage: 'event_deliverable', lifecycleState: 'stored', providerName: 'test', providerObjectKey: 'events/evt_1/billing.pdf', contentType: 'application/pdf', declaredByteSize: 1, checksumSha256: 'a'.repeat(64), originalFileName: 'billing.pdf' });
    const adapter = { issueDownloadAuthorization: vi.fn(async () => ({ downloadUrl: 'https://storage.example.test/signed-billing', expiresAt: new Date('2026-10-20T00:00:00.000Z') })) };
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter as never, store.platformReferences as never, store.auditWriter as never);

    await expect(service.listEventObjects('evt_1', client)).resolves.toEqual([]);
    await expect(service.issueDownloadAuthorization({ objectId: 'obj_billing', actor: client })).rejects.toBeInstanceOf(NotFoundException);
    expect(adapter.issueDownloadAuthorization).not.toHaveBeenCalled();
    await expect(service.listEventObjects('evt_1', actor)).resolves.toHaveLength(1);
    await expect(service.issueDownloadAuthorization({ objectId: 'obj_billing', actor })).resolves.toMatchObject({ downloadUrl: 'https://storage.example.test/signed-billing' });

    store.statements[0].sentAt = new Date('2026-10-20T00:00:00.000Z');
    await expect(service.listEventObjects('evt_1', client)).resolves.toHaveLength(1);
    await expect(service.issueDownloadAuthorization({ objectId: 'obj_billing', actor: client })).resolves.toMatchObject({ downloadUrl: 'https://storage.example.test/signed-billing' });
  });

  it('writes metadata-only audit rows for confirmed uploads, download authorizations and deletes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prism-storage-audit-'));
    roots.push(root);
    const store = createStore();
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), new LocalFileSystemStorageAdapter(root), store.platformReferences as never, store.auditWriter as never);
    const requested = await service.requestUpload({ ...request, actor });
    if (requested.status !== 'ready') throw new Error('expected upload location');
    await service.writeAuthorizedUpload({ objectId: requested.object.id, uploadUrl: requested.location.uploadUrl, bytes, actor });
    const stored = await service.confirmUpload({ objectId: requested.object.id, byteSize: bytes.byteLength, checksumSha256, actor });
    const authorization = await service.issueDownloadAuthorization({ objectId: stored.id, actor });
    await service.deleteObject({ objectId: stored.id, actor });

    const audits = store.auditWriter.write.mock.calls.map(([input]) => input as Record<string, any>);
    expect(audits.map((audit) => audit.metadata?.storageAction)).toEqual(['upload_confirmed', 'download_authorized', 'deleted']);
    expect(audits.every((audit) => audit.eventId === 'evt_1' && audit.actor === actorSnapshot.name)).toBe(true);
    const serialized = JSON.stringify(audits);
    expect(serialized).not.toContain(authorization.downloadUrl);
    expect(serialized).not.toContain(requested.location.uploadUrl);
    expect(serialized).not.toContain('events/evt_1/');
  });

  it('derives supplier event access from the read-model supplier scope', async () => {
    const store = createStore();
    const supplier = { id: 'supplier-user', role: 'supplier', supplierId: 'sup_1', eventId: 'evt_1', name: 'Supplier', explicit: true, verified: true } as never;
    store.platformReferences.findStorageEventScope.mockResolvedValue({
      id: 'evt_1', archived: false, clientName: 'Client', clientPortalStatus: 'unlocked', clientEmail: 'client@example.test', supplierIds: ['sup_1'], supplierContacts: [{ supplierId: 'sup_1', email: 'supplier@example.test' }],
    });

    await expect(store.service.listEventObjects('evt_1', supplier)).resolves.toEqual([]);
    expect(store.accessPolicy.requireCanReadEvent).toHaveBeenCalledWith(
      supplier,
      expect.objectContaining({ id: 'evt_1', clientEmail: 'client@example.test' }),
      'list event documents',
      { supplierEventIds: ['evt_1'] },
    );
  });

  it('rejects a legacy unsupported supplier-document reference during retrieval', async () => {
    const store = createStore();
    store.objects.push({ id: 'obj_supplier', eventId: 'evt_1', ownerRecordType: 'supplier', ownerRecordId: 'sup_1', usage: 'supplier_document', lifecycleState: 'stored', providerObjectKey: 'events/evt_1/supplier.pdf', contentType: 'application/pdf', declaredByteSize: 1, checksumSha256: 'a'.repeat(64), originalFileName: 'supplier.pdf' });
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), {} as never, store.platformReferences as never);
    await expect(service.issueDownloadAuthorization({ objectId: 'obj_supplier', actor: client })).rejects.toThrow(/cannot access/);
  });

  it('denies a supplier retrying a logical target owned by another supplier', async () => {
    const store = createStore();
    store.objects.push({
      id: 'obj_other_supplier', eventId: 'evt_1', usage: 'supplier_document', logicalTarget: 'supplier-contract:req_1:123e4567-e89b-42d3-a456-426614174000',
      ownerRecordType: 'supplier', ownerRecordId: 'sup_other', uploaderActorId: 'other-user', uploaderActorRole: 'supplier',
      contentType: 'application/pdf', declaredByteSize: bytes.byteLength, checksumSha256, originalFileName: 'signed.pdf', lifecycleState: 'stored',
    });
    const supplier = { id: 'supplier-user', role: 'supplier', supplierId: 'sup_1', eventId: 'evt_1', name: 'Supplier', explicit: true } as never;
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), {} as never, store.platformReferences as never);
    await expect(service.requestUpload({
      ...request, usage: 'supplier_document' as const, ownerRecordType: 'supplier', ownerRecordId: 'sup_other',
      logicalTarget: 'supplier-contract:req_1:123e4567-e89b-42d3-a456-426614174000', actor: supplier,
    })).rejects.toThrow(/verified supplier|outside/);
  });

  it('resolves a signed-in supplier by persisted booking email for upload, confirmation and download', async () => {
    const store = createStore();
    store.platformReferences.findStorageEventScope.mockResolvedValue({
      id: 'evt_1', archived: false, clientName: 'Client', clientPortalStatus: 'unlocked', clientEmail: 'client@example.test',
      supplierIds: ['sup_1'], supplierContacts: [{ supplierId: 'sup_1', email: 'supplier@example.test' }],
    });
    const root = await mkdtemp(join(tmpdir(), 'prism-supplier-storage-'));
    roots.push(root);
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), new LocalFileSystemStorageAdapter(root), store.platformReferences as never);
    const supplier = { id: 'supplier-user', role: 'supplier', email: 'SUPPLIER@example.test', name: 'Supplier', explicit: true, verified: true } as never;
    const declaration = { ...request, usage: 'supplier_document' as const, ownerRecordType: 'supplier', ownerRecordId: 'sup_1', logicalTarget: 'supplier-contract:req_1:123e4567-e89b-42d3-a456-426614174000' };
    store.bookings[0].status = 'submitted';
    await expect(service.requestUpload({ ...declaration, actor: supplier })).rejects.toThrow(/outside the verified booking/);
    expect(store.objects).toHaveLength(0);
    store.bookings[0].status = 'selected';
    const requested = await service.requestUpload({ ...declaration, actor: supplier });
    if (requested.status !== 'ready') throw new Error('expected upload location');
    await service.writeAuthorizedUpload({ objectId: requested.object.id, uploadUrl: requested.location.uploadUrl, bytes, actor: supplier });
    const stored = await service.confirmUpload({ objectId: requested.object.id, byteSize: bytes.byteLength, checksumSha256, actor: supplier });
    const authorization = await service.issueDownloadAuthorization({ objectId: stored.id, actor: supplier });
    await expect(service.readAuthorizedDownload({ objectId: stored.id, downloadUrl: authorization.downloadUrl, actor: supplier })).resolves.toEqual(bytes);
    await expect(service.requestUpload({ ...declaration, ownerRecordId: 'sup_other', actor: supplier })).rejects.toThrow(/verified supplier/);
    const other = { id: 'other-user', role: 'supplier', email: 'other@example.test', name: 'Other supplier', explicit: true, verified: true } as never;
    await expect(service.issueDownloadAuthorization({ objectId: stored.id, actor: other })).rejects.toThrow(/outside.*scope/);
  });

  it('prevents a different actor from reusing the uploader logical target', async () => {
    const store = createStore();
    const adapter = { requestUploadLocation: vi.fn(async (input: { providerObjectKey: string }) => ({ providerName: 'test', providerObjectKey: input.providerObjectKey, uploadUrl: 'test://upload', expiresAt: new Date(Date.now() + 1000) })), confirmUpload: vi.fn(), issueDownloadAuthorization: vi.fn(), deleteObject: vi.fn() };
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter, store.platformReferences as never);
    await service.requestUpload({ ...request, actor });
    const otherActor = { ...actorSnapshot, id: 'other-pmcm-user' } as never;
    await expect(service.requestUpload({ ...request, actor: otherActor })).rejects.toThrow(/different content/);
  });

  it('denies a supplier deleting an object even when the event is in scope', async () => {
    const store = createStore();
    store.objects.push({ id: 'obj_supplier', eventId: 'evt_1', ownerRecordType: 'billing_statement', ownerRecordId: 'bill_1', usage: 'event_deliverable', lifecycleState: 'stored', providerObjectKey: 'events/evt_1/supplier.pdf', contentType: 'application/pdf', declaredByteSize: 1, checksumSha256: 'a'.repeat(64), originalFileName: 'supplier.pdf' });
    const supplier = { id: 'supplier-user', role: 'supplier', supplierId: 'sup_1', eventId: 'evt_1', name: 'Supplier', explicit: true } as never;
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), {} as never, store.platformReferences as never);
    await expect(service.deleteObject({ objectId: 'obj_supplier', actor: supplier })).rejects.toThrow(/cannot access/);
  });
  it('validates event, game, stored state, image type, and size for referenced media', async () => {
    const objectId = 'obj_a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5';
    const store = createStore();
    const object = {
      id: objectId, eventId: 'evt_1', ownerRecordType: 'event_game_definition',
      ownerRecordId: 'game-1', usage: 'event_game_media', lifecycleState: 'stored',
      providerObjectKey: 'events/evt_1/game-media/picture.png', contentType: 'image/png',
      declaredByteSize: 1024, checksumSha256: 'a'.repeat(64), originalFileName: 'picture.png',
    };
    store.prisma.opsStoredObject.findMany.mockResolvedValueOnce([object]);
    const mediaStorage = store.service as unknown as {
      validateEventGameMediaReferences(input: { eventId: string; gameId: string; objectIds: string[] }): Promise<void>;
    };

    await expect(mediaStorage.validateEventGameMediaReferences({
      eventId: 'evt_1', gameId: 'game-1', objectIds: [objectId],
    })).resolves.toBeUndefined();
    expect(store.prisma.opsStoredObject.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { in: [objectId] }, eventId: 'evt_1', ownerRecordType: 'event_game_definition',
        ownerRecordId: 'game-1', usage: 'event_game_media', lifecycleState: 'stored',
      }),
    }));

    store.prisma.opsStoredObject.findMany.mockResolvedValueOnce([{ ...object, eventId: 'evt_other' }]);
    await expect(mediaStorage.validateEventGameMediaReferences({
      eventId: 'evt_1', gameId: 'game-1', objectIds: [objectId],
    })).rejects.toThrow(/media objects are unavailable/);
  });

  it('issues a participant authorization only for stored media owned by the exact event game', async () => {
    const store = createStore();
    const object = {
      id: 'obj_a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5',
      eventId: 'evt_1',
      ownerRecordType: 'event_game_definition',
      ownerRecordId: 'game-1',
      usage: 'event_game_media',
      lifecycleState: 'stored',
      providerObjectKey: 'events/evt_1/objects/event_game_media/clue.png',
      contentType: 'image/png',
      declaredByteSize: 1024,
      checksumSha256: 'a'.repeat(64),
      originalFileName: 'clue.png',
      deletedAt: null,
    };
    store.objects.push(object);
    const expiresAt = new Date('2026-10-16T12:05:00.000Z');
    const issueDownloadAuthorization = vi.fn().mockResolvedValue({
      providerName: 'test-storage',
      providerObjectKey: object.providerObjectKey,
      downloadUrl: 'https://storage.example.test/signed-image',
      expiresAt,
    });
    const service = new StorageObjectService(
      store.prisma as never,
      store.accessPolicy as never,
      new StorageValidationService(),
      { issueDownloadAuthorization } as never,
      store.platformReferences as never,
    );

    await expect(service.issueEventGameMediaDownloadAuthorization({
      eventId: 'evt_1', gameId: 'game-1', objectId: object.id,
    })).resolves.toEqual({
      downloadUrl: 'https://storage.example.test/signed-image',
      expiresAt: expiresAt.toISOString(),
    });
    expect(issueDownloadAuthorization).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'evt_1',
      usage: 'event_game_media',
      providerObjectKey: object.providerObjectKey,
    }));

    await expect(service.issueEventGameMediaDownloadAuthorization({
      eventId: 'evt_other', gameId: 'game-1', objectId: object.id,
    })).rejects.toThrow(/media objects are unavailable/);
    expect(issueDownloadAuthorization).toHaveBeenCalledTimes(1);
  });

  it('keeps game media off the generic event-object download route', async () => {
    const store = createStore();
    store.objects.push({
      id: 'obj_game_media', eventId: 'evt_1', ownerRecordType: 'event_game_definition',
      ownerRecordId: 'game-1', usage: 'event_game_media', lifecycleState: 'stored',
      providerObjectKey: 'events/evt_1/game-media/picture.png', contentType: 'image/png',
      declaredByteSize: 1024, checksumSha256: 'a'.repeat(64), originalFileName: 'picture.png',
    });

    await expect(store.service.issueDownloadAuthorization({ objectId: 'obj_game_media', actor }))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(store.service.listEventObjects('evt_1', actor)).resolves.toEqual([]);
  });

  it('serves a stored lobby logo only through its exact event-owned public branding path', async () => {
    const store = createStore();
    const object = {
      id: 'obj_a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5',
      eventId: 'evt_1',
      ownerRecordType: 'event_game_lobby',
      ownerRecordId: 'evt_1',
      usage: 'event_game_branding',
      lifecycleState: 'stored',
      providerObjectKey: 'events/evt_1/objects/event_game_branding/logo.png',
      contentType: 'image/png',
      declaredByteSize: 1024,
      checksumSha256: 'a'.repeat(64),
      originalFileName: 'logo.png',
      deletedAt: null,
    };
    store.objects.push(object);
    const expiresAt = new Date('2026-10-16T12:05:00.000Z');
    const issueDownloadAuthorization = vi.fn().mockResolvedValue({
      providerName: 'test-storage',
      providerObjectKey: object.providerObjectKey,
      downloadUrl: 'https://storage.example.test/signed-logo',
      expiresAt,
    });
    const service = new StorageObjectService(
      store.prisma as never,
      store.accessPolicy as never,
      new StorageValidationService(),
      { issueDownloadAuthorization } as never,
      store.platformReferences as never,
    );

    await expect(service.issueEventGameLobbyLogoDownloadAuthorization({ eventId: 'evt_1', objectId: object.id }))
      .resolves.toEqual({ downloadUrl: 'https://storage.example.test/signed-logo', expiresAt: expiresAt.toISOString() });
    await expect(service.validateEventGameLobbyLogoReference({ eventId: 'evt_1', objectId: object.id })).resolves.toBeUndefined();
    await expect(service.issueEventGameLobbyLogoDownloadAuthorization({ eventId: 'evt_other', objectId: object.id }))
      .rejects.toThrow(/logo is unavailable/);
    await expect(service.issueDownloadAuthorization({ objectId: object.id, actor }))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.listEventObjects('evt_1', actor)).resolves.toEqual([]);
    expect(issueDownloadAuthorization).toHaveBeenCalledTimes(1);
  });

  it('rejects lobby logo uploads whose owner does not match the event', async () => {
    const { service } = createStore();
    await expect(service.requestUpload({
      eventId: 'evt_1', ownerRecordType: 'event_game_lobby', ownerRecordId: 'evt_other',
      logicalTarget: 'lobby-logo:upload-1', usage: 'event_game_branding', fileName: 'logo.png',
      contentType: 'image/png', declaredByteSize: 1024, checksumSha256: 'a'.repeat(64), actor,
    })).rejects.toThrow(/scoped to its event lobby/);
  });
});
