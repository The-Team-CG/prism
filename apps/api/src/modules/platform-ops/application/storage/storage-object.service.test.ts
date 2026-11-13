import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { LocalFileSystemStorageAdapter } from '../../infrastructure/storage/local-filesystem-storage.adapter';
import { StorageObjectService } from './storage-object.service';
import { StorageValidationService } from './storage-validation.service';

const actorSnapshot = { id: 'user_pmcm', role: 'pmcm-admin', name: 'PMCM Admin', explicit: true, verified: true };
const actor = actorSnapshot as never;
const client = { id: 'user_client', role: 'client', email: 'client@example.test', name: 'Client', eventId: 'evt_1', explicit: true, verified: true } as never;
/** The same client signed in to the portal rather than to one event: reads every event they own. */
const clientAccount = { id: 'user_client', role: 'client', email: 'client@example.test', name: 'Client', explicit: true, verified: true } as never;

function createStore() {
  const objects: Array<Record<string, any>> = [];
  const statements: Array<{ id: string; sentAt: Date | null }> = [];
  const bookings = [{ id: 'req_1', eventId: 'evt_1', supplierId: 'sup_1', status: 'selected', assignmentStatus: 'confirmed' }];
  const now = () => new Date('2026-09-08T00:00:00.000Z');
  // The Prisma filters the service uses: equality (including null), `in`, `not` and `lt`.
  const matches = (object: Record<string, any>, where: Record<string, any>) => Object.entries(where).every(([key, condition]) => {
    if (condition === null || typeof condition !== 'object' || condition instanceof Date) return (object[key] ?? null) === condition;
    if ('in' in condition) return condition.in.includes(object[key]);
    if ('lt' in condition) return object[key] instanceof Date && object[key].getTime() < condition.lt.getTime();
    if ('not' in condition) return (object[key] ?? null) !== condition.not;
    return true;
  });
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
        if (where.id?.in) {
          const hits = objects.filter((candidate) => where.id.in.includes(candidate.id));
          hits.forEach((candidate) => Object.assign(candidate, data, { updatedAt: now() }));
          return { count: hits.length };
        }
        const object = objects.find((candidate) => matches(candidate, where));
        if (!object) return { count: 0 };
        Object.assign(object, data, { updatedAt: now() });
        return { count: 1 };
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const object = objects.find((candidate) => candidate.id === where.id);
        if (!object) throw new Error('object missing');
        return object;
      }),
      findMany: vi.fn(async ({ where }: { where: Record<string, any> }) => objects.filter((object) => matches(object, where))),
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
    opsClientReviewItem: { findFirst: vi.fn(async ({ where }: { where: Record<string, string> }) => (where.id === 'client_review_1' && where.eventId === 'evt_1' && where.kind === 'styling' ? { id: 'client_review_1' } : null)) },
    // One live receipt held for evt_1; a rejected one and one held for another event prove the owner check reads both.
    opsPaymentReceipt: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; eventId: string; status: { in: string[] } } }) => {
        const receipts = [{ id: 'prcp_1', eventId: 'evt_1', status: 'recorded' }, { id: 'prcp_rejected', eventId: 'evt_1', status: 'rejected' }, { id: 'prcp_other', eventId: 'evt_2', status: 'recorded' }];
        return receipts.find((receipt) => receipt.id === where.id && receipt.eventId === where.eventId && where.status.in.includes(receipt.status)) ?? null;
      }),
    },
    $queryRaw: vi.fn(async () => [{ id: 'evt_1' }]),
    $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work(prisma)),
  };
  const requirementVisibility: Record<string, string[]> = {};
  const coordinatorAssignments: Array<{ coordinatorId: string | null; coordinator: { userId: string | null; email: string | null } | null }> = [];
  const auditWriter = { write: vi.fn(async (_input: Record<string, any>) => undefined) };
  // The real policy: assignment, booking, and portal gates are what these tests exercise.
  const accessPolicy = new EventAccessPolicyService(auditWriter as never);
  const platformReferences = {
    findStorageEventScope: vi.fn(async (eventId: string) => {
      // evt_1 and evt_2 belong to the same client; evt_3 belongs to someone else.
      const owners: Record<string, string> = { evt_1: 'client@example.test', evt_2: 'client@example.test', evt_3: 'other@example.test' };
      if (!owners[eventId]) return null;
      return {
        id: eventId, archived: false, clientName: 'Client', clientPortalStatus: 'unlocked', clientEmail: owners[eventId],
        coordinatorAssignments: eventId === 'evt_1' ? coordinatorAssignments : [],
        supplierQuoteRequests: eventId === 'evt_1' ? bookings.map((booking) => ({ supplierId: booking.supplierId, status: booking.status, supplier: { email: 'supplier@example.test' } })) : [],
      };
    }),
    findClientEventIds: vi.fn(async (email: string) => (email === 'client@example.test' ? ['evt_2', 'evt_1'] : [])),
    findFileRequirementVisibility: vi.fn(async () => requirementVisibility),
    supplierMayUploadRequirement: vi.fn(async (_eventId: string, key: string) => key === 'insurance'),
    findStoredObjectRequirementBindings: vi.fn(async () => []),
  };
  return {
    objects,
    statements,
    bookings,
    coordinatorAssignments,
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

  it('accepts a moodboard image only under a styling option of the same event', async () => {
    const { service } = createStore();
    const moodboard = { ...request, ownerRecordType: 'client_review_item', ownerRecordId: 'client_review_1', logicalTarget: 'styling-moodboard:client_review_1:123e4567-e89b-42d3-a456-426614174000' };
    await expect(service.requestUpload({ ...moodboard, actor })).resolves.toMatchObject({ status: 'failed', reason: 'Storage provider is not configured' });
    await expect(service.requestUpload({ ...moodboard, ownerRecordId: 'client_review_other', logicalTarget: 'styling-moodboard:client_review_other:123e4567-e89b-42d3-a456-426614174000', actor })).rejects.toThrow('styling option of this event');
    await expect(service.requestUpload({ ...moodboard, logicalTarget: 'styling-moodboard:client_review_2:123e4567-e89b-42d3-a456-426614174000', actor })).rejects.toThrow('target their styling option');
  });

  it('accepts receipt evidence only from PMCM, for a live receipt of the same event, under its own target', async () => {
    const { service } = createStore();
    const target = (receiptId: string) => `payment-receipt-evidence:${receiptId}:123e4567-e89b-42d3-a456-426614174000`;
    const evidence = { ...request, ownerRecordType: 'payment_receipt', ownerRecordId: 'prcp_1', logicalTarget: target('prcp_1'), usage: 'payment_receipt_evidence' as const };
    await expect(service.requestUpload({ ...evidence, actor })).resolves.toMatchObject({ status: 'failed', reason: 'Storage provider is not configured' });
    // A receipt that is rejected, or held for another event, takes no proof from this one.
    await expect(service.requestUpload({ ...evidence, ownerRecordId: 'prcp_rejected', logicalTarget: target('prcp_rejected'), actor })).rejects.toThrow('live receipt held for this event');
    await expect(service.requestUpload({ ...evidence, ownerRecordId: 'prcp_other', logicalTarget: target('prcp_other'), actor })).rejects.toThrow('live receipt held for this event');
    // The target must name the receipt it is uploaded for, and the owner must be a receipt at all.
    await expect(service.requestUpload({ ...evidence, logicalTarget: target('prcp_other'), actor })).rejects.toThrow('target its own receipt');
    await expect(service.requestUpload({ ...evidence, ownerRecordType: 'billing_statement', actor })).rejects.toThrow();
    // Proof of payment is finance paperwork: the client who owns the event cannot upload or read it.
    await expect(service.requestUpload({ ...evidence, actor: client })).rejects.toThrow(ForbiddenException);
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
    const requireActorRole = vi.spyOn(store.accessPolicy, 'requireActorRole');

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
    expect(requireActorRole).not.toHaveBeenCalled();
  });

  it('rejects writes to an archived event before requesting provider authorization', async () => {
    const store = createStore();
    store.platformReferences.findStorageEventScope.mockResolvedValue({
      id: 'evt_1', archived: true, clientName: 'Client', clientPortalStatus: 'unlocked', clientEmail: 'client@example.test', coordinatorAssignments: [], supplierQuoteRequests: [],
    });
    const adapter = { requestUploadLocation: vi.fn(), confirmUpload: vi.fn(), issueDownloadAuthorization: vi.fn(), deleteObject: vi.fn() };
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter, store.platformReferences as never);
    await expect(service.requestUpload({ ...request, actor })).rejects.toThrow(/Archived events/);
    expect(adapter.requestUploadLocation).not.toHaveBeenCalled();
  });

  it('stores guest feedback media only when the bytes are a real image, keeps it PMCM-only, and erases it on request', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prism-guest-media-'));
    roots.push(root);
    const store = createStore();
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), new LocalFileSystemStorageAdapter(root), store.platformReferences as never);
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);

    await expect(service.storeGuestFeedbackMedia({ eventId: 'evt_1', fileName: 'table.png', contentType: 'image/png', bytes: Buffer.from('not really a png') })).rejects.toThrow('Uploaded bytes do not match the declared file type');
    expect(store.objects).toHaveLength(0);

    const stored = await service.storeGuestFeedbackMedia({ eventId: 'evt_1', fileName: 'table.png', contentType: 'image/png', bytes: png });
    expect(stored).toMatchObject({ originalFileName: 'table.png', contentType: 'image/png', byteSize: png.byteLength });
    expect(await service.findStoredGuestFeedbackMedia({ eventId: 'evt_1', objectId: stored.id })).toMatchObject({ id: stored.id });
    expect(await service.findStoredGuestFeedbackMedia({ eventId: 'evt_other', objectId: stored.id })).toBeNull();
    // The generic session routes cannot reach guest media, and a client cannot download it.
    await expect(service.requestUpload({ ...request, ownerRecordType: 'event', ownerRecordId: 'evt_1', usage: 'guest_feedback_media', actor })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.issueDownloadAuthorization({ objectId: stored.id, actor: client })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.issueDownloadAuthorization({ objectId: stored.id, actor })).resolves.toMatchObject({ fileName: 'table.png' });

    await expect(service.eraseGuestFeedbackMedia([stored.id], store.prisma as never)).resolves.toBe(1);
    expect(store.objects.find((object) => object.id === stored.id)).toMatchObject({ lifecycleState: 'deleted', originalFileName: '[redacted by privacy request]' });
    expect(await service.findStoredGuestFeedbackMedia({ eventId: 'evt_1', objectId: stored.id })).toBeNull();
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

  it('lets a supplier read event files only while its booking on the event is selected', async () => {
    const store = createStore();
    const supplier = { id: 'supplier-user', role: 'supplier', supplierId: 'sup_1', eventId: 'evt_1', name: 'Supplier', explicit: true, verified: true } as never;

    await expect(store.service.listEventObjects('evt_1', supplier)).resolves.toEqual([]);
    store.bookings[0].status = 'declined';
    await expect(store.service.listEventObjects('evt_1', supplier)).rejects.toBeInstanceOf(ForbiddenException);
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
    const root = await mkdtemp(join(tmpdir(), 'prism-supplier-storage-'));
    roots.push(root);
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), new LocalFileSystemStorageAdapter(root), store.platformReferences as never);
    const supplier = { id: 'supplier-user', role: 'supplier', email: 'SUPPLIER@example.test', name: 'Supplier', explicit: true, verified: true } as never;
    const declaration = { ...request, usage: 'supplier_document' as const, ownerRecordType: 'supplier', ownerRecordId: 'sup_1', logicalTarget: 'supplier-contract:req_1:123e4567-e89b-42d3-a456-426614174000' };
    store.bookings[0].status = 'submitted';
    await expect(service.requestUpload({ ...declaration, actor: supplier })).rejects.toBeInstanceOf(ForbiddenException);
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
    await expect(service.issueDownloadAuthorization({ objectId: stored.id, actor: other })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts requirement uploads only for a selected supplier and an eligible requirement', async () => {
    const store = createStore();
    const root = await mkdtemp(join(tmpdir(), 'prism-requirement-storage-'));
    roots.push(root);
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), new LocalFileSystemStorageAdapter(root), store.platformReferences as never);
    const supplier = { id: 'supplier-user', role: 'supplier', email: 'supplier@example.test', name: 'Supplier', explicit: true, verified: true } as never;
    const declaration = { ...request, usage: 'supplier_document' as const, ownerRecordType: 'supplier', ownerRecordId: 'sup_1', logicalTarget: 'supplier-requirement:insurance:123e4567-e89b-42d3-a456-426614174000' };
    const result = await service.requestUpload({ ...declaration, actor: supplier });
    if (result.status !== 'ready') throw new Error('expected upload location');
    await service.writeAuthorizedUpload({ objectId: result.object.id, uploadUrl: result.location.uploadUrl, bytes, actor: supplier });
    const stored = await service.confirmUpload({ objectId: result.object.id, byteSize: bytes.byteLength, checksumSha256, actor: supplier });
    expect(stored.lifecycleState).toBe('stored');
    await expect(service.requestUpload({ ...declaration, logicalTarget: declaration.logicalTarget.replace('insurance', 'unknown'), actor: supplier })).rejects.toBeInstanceOf(ForbiddenException);
    store.bookings[0].status = 'declined';
    await expect(service.requestUpload({ ...declaration, actor: supplier })).rejects.toBeInstanceOf(ForbiddenException);
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

describe('file access: lists and downloads follow one policy', () => {
  const at = new Date('2026-10-19T00:00:00.000Z');
  const shared = { eventId: 'evt_1', lifecycleState: 'stored', providerName: 'test', providerObjectKey: 'events/evt_1/file.pdf', contentType: 'application/pdf', declaredByteSize: 1, checksumSha256: 'a'.repeat(64), uploaderActorId: 'uploader', uploaderActorRole: 'pmcm-admin', requestedAt: at, storedAt: at, failedAt: null, failureReason: null, deletedAt: null, createdAt: at, updatedAt: at, logicalTarget: 'file' };

  /** One stored file of every supported kind on evt_1, with a billing statement that PMCM has sent. */
  function storedFiles() {
    const store = createStore();
    store.objects.push(
      { ...shared, id: 'obj_conforme', ownerRecordType: 'event', ownerRecordId: 'evt_1', usage: 'signed_conforme', originalFileName: 'conforme.pdf' },
      { ...shared, id: 'obj_client_doc', ownerRecordType: 'event', ownerRecordId: 'evt_1', usage: 'client_document', originalFileName: 'client.pdf' },
      { ...shared, id: 'obj_billing', ownerRecordType: 'billing_statement', ownerRecordId: 'bill_1', usage: 'event_deliverable', originalFileName: 'billing.pdf' },
      { ...shared, id: 'obj_proposal', ownerRecordType: 'proposal_version', ownerRecordId: 'prop_1', usage: 'event_deliverable', originalFileName: 'proposal.pdf' },
      { ...shared, id: 'obj_supplier_own', ownerRecordType: 'supplier', ownerRecordId: 'sup_1', usage: 'supplier_document', originalFileName: 'contract.pdf' },
      { ...shared, id: 'obj_supplier_other', ownerRecordType: 'supplier', ownerRecordId: 'sup_2', usage: 'supplier_document', originalFileName: 'other.pdf' },
    );
    store.statements.push({ id: 'bill_1', sentAt: new Date('2026-10-20T00:00:00.000Z') });
    return store;
  }

  function serviceFor(store: ReturnType<typeof storedFiles>) {
    const adapter = { issueDownloadAuthorization: vi.fn(async () => ({ downloadUrl: 'https://storage.example.test/signed', expiresAt: new Date('2026-10-20T00:00:00.000Z') })) };
    return new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter as never, store.platformReferences as never, store.auditWriter as never);
  }

  const ALL_OBJECTS = ['obj_conforme', 'obj_client_doc', 'obj_billing', 'obj_proposal', 'obj_supplier_own', 'obj_supplier_other'];
  const coordinatorToken = { id: 'user_coord', role: 'coordinator', email: 'coord@example.test', name: 'Coordinator', explicit: true, verified: true, eventId: 'evt_1', coordinatorId: 'coord_1' } as never;
  const supplierToken = { id: 'supplier-user', role: 'supplier', supplierId: 'sup_1', eventId: 'evt_1', name: 'Supplier', explicit: true, verified: true } as never;

  // The expected visible set for each actor; `forbidden` means the list itself is refused.
  it.each([
    ['PMCM', 'pmcm', () => {}, actor, ALL_OBJECTS],
    ['client, unlocked event', 'client', () => {}, client, ['obj_conforme', 'obj_client_doc', 'obj_billing', 'obj_proposal']],
    ['coordinator with a current assignment', 'coordinator', (store: ReturnType<typeof storedFiles>) => {
      store.coordinatorAssignments.push({ coordinatorId: 'coord_1', coordinator: { userId: 'user_coord', email: 'coord@example.test' } });
    }, coordinatorToken, ['obj_client_doc']],
    ['coordinator token without an assignment', 'coordinator-unassigned', () => {}, coordinatorToken, 'forbidden'],
    ['supplier with a selected booking', 'supplier-selected', () => {}, supplierToken, ['obj_supplier_own']],
    ['supplier whose booking was declined', 'supplier-declined', (store: ReturnType<typeof storedFiles>) => {
      store.bookings[0].status = 'declined';
    }, supplierToken, 'forbidden'],
    ['supplier with no booking on the event', 'supplier-stranger', (store: ReturnType<typeof storedFiles>) => {
      store.bookings.length = 0;
    }, supplierToken, 'forbidden'],
  ] as const)('%s: the list shows exactly what the download allows', async (_label, _key, prepare, who, expected) => {
    const store = storedFiles();
    prepare(store);
    const service = serviceFor(store);
    if (expected === 'forbidden') {
      await expect(service.listEventObjects('evt_1', who as never)).rejects.toBeInstanceOf(ForbiddenException);
    } else {
      const listed = await service.listEventObjects('evt_1', who as never);
      expect(listed.map((object) => object.id).sort()).toEqual([...expected].sort());
    }
    for (const objectId of ALL_OBJECTS) {
      const allowed = await service.issueDownloadAuthorization({ objectId, actor: who as never }).then(() => true, (error: unknown) => {
        if (error instanceof ForbiddenException) return false;
        throw error;
      });
      expect(allowed).toBe(expected !== 'forbidden' && (expected as readonly string[]).includes(objectId));
    }
  });

  it('ends a coordinator\'s file access the moment its assignment ends, even with a live token', async () => {
    const store = storedFiles();
    store.coordinatorAssignments.push({ coordinatorId: 'coord_1', coordinator: { userId: 'user_coord', email: 'coord@example.test' } });
    const service = serviceFor(store);
    await expect(service.listEventObjects('evt_1', coordinatorToken)).resolves.toHaveLength(1);

    store.coordinatorAssignments.length = 0;
    await expect(service.listEventObjects('evt_1', coordinatorToken)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.issueDownloadAuthorization({ objectId: 'obj_client_doc', actor: coordinatorToken })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('shows failed and requested uploads, and provider detail, to PMCM only', async () => {
    const store = storedFiles();
    store.objects.push({ ...store.objects[1], id: 'obj_failed', lifecycleState: 'failed', failureReason: 'provider timeout', failedAt: at, providerObjectKey: 'events/evt_1/retry.pdf' });
    store.coordinatorAssignments.push({ coordinatorId: 'coord_1', coordinator: { userId: 'user_coord', email: 'coord@example.test' } });
    const service = serviceFor(store);

    const clientList = await service.listEventObjects('evt_1', client);
    expect(clientList.map((object) => object.id)).not.toContain('obj_failed');
    const coordinatorList = await service.listEventObjects('evt_1', coordinatorToken);
    expect(coordinatorList.every((object) => !('providerObjectKey' in object) && !('failureReason' in object))).toBe(true);
    expect((await service.listEventObjects('evt_1', actor)).find((object) => object.id === 'obj_failed'))
      .toMatchObject({ failureReason: 'provider timeout', providerObjectKey: 'events/evt_1/retry.pdf' });
  });

  describe('client files across events', () => {
    const target = (eventId: string) => `client-upload:${eventId}:${randomUUID()}`;

    async function storeClientFile(service: StorageObjectService, eventId: string, fileName: string) {
      const requested = await service.requestUpload({ eventId, ownerRecordType: 'event', ownerRecordId: eventId, logicalTarget: target(eventId), usage: 'client_document', fileName, contentType: 'application/pdf', declaredByteSize: bytes.byteLength, checksumSha256, actor: clientAccount });
      if (requested.status !== 'ready') throw new Error('expected upload location');
      await service.writeAuthorizedUpload({ objectId: requested.object.id, uploadUrl: requested.location.uploadUrl, bytes, actor: clientAccount });
      return service.confirmUpload({ objectId: requested.object.id, byteSize: bytes.byteLength, checksumSha256, actor: clientAccount });
    }

    async function localService() {
      const root = await mkdtemp(join(tmpdir(), 'prism-storage-copy-'));
      roots.push(root);
      const adapter = new LocalFileSystemStorageAdapter(root);
      const store = createStore();
      return { store, adapter, service: new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter, store.platformReferences as never, store.auditWriter as never) };
    }

    it("copies a client's file into another of their events as that event's own document, once per target", async () => {
      const { service, adapter, store } = await localService();
      const source = await storeClientFile(service, 'evt_1', 'venue-permit.pdf');
      const logicalTarget = target('evt_2');

      const copy = await service.copyToClientEvent({ sourceObjectId: source.id, eventId: 'evt_2', logicalTarget, actor: clientAccount });
      const again = await service.copyToClientEvent({ sourceObjectId: source.id, eventId: 'evt_2', logicalTarget, actor: clientAccount });

      expect(copy).toMatchObject({ eventId: 'evt_2', usage: 'client_document', lifecycleState: 'stored', originalFileName: 'venue-permit.pdf', uploaderActorRole: 'client' });
      expect(copy.id).not.toBe(source.id);
      expect(copy).not.toHaveProperty('providerObjectKey');
      expect(again.id).toBe(copy.id);
      const authorization = await service.issueDownloadAuthorization({ objectId: copy.id, actor: clientAccount });
      await expect(adapter.readBytes(authorization.downloadUrl)).resolves.toEqual(bytes);
      const copied = store.auditWriter.write.mock.calls.map(([audit]) => audit as Record<string, any>).filter((audit) => audit.metadata?.storageAction === 'copied');
      expect(copied).toEqual([expect.objectContaining({ eventId: 'evt_2', metadata: expect.objectContaining({ sourceObjectId: source.id, sourceEventId: 'evt_1' }) })]);
      expect(JSON.stringify(copied)).not.toContain('events/evt_1/');
    });

    it('lets the sender or PMCM date a file, carries the date onto a copy, and refuses anyone else', async () => {
      const { service, store } = await localService();
      const source = await storeClientFile(service, 'evt_1', 'venue-permit.pdf');

      await expect(service.setObjectExpiry({ objectId: source.id, expiresAt: '2026-12-31', actor: clientAccount })).resolves.toMatchObject({ expiresAt: '2026-12-31T00:00:00.000Z' });
      const copy = await service.copyToClientEvent({ sourceObjectId: source.id, eventId: 'evt_2', logicalTarget: target('evt_2'), actor: clientAccount });
      expect(copy.expiresAt).toBe('2026-12-31T00:00:00.000Z');

      const someoneElse = { id: 'user_other_client', role: 'client', email: 'client@example.test', name: 'Other', explicit: true, verified: true } as never;
      await expect(service.setObjectExpiry({ objectId: source.id, expiresAt: null, actor: someoneElse })).rejects.toThrow(ForbiddenException);
      await expect(service.setObjectExpiry({ objectId: source.id, expiresAt: null, actor })).resolves.toMatchObject({ expiresAt: null });
      const dated = store.auditWriter.write.mock.calls.map(([audit]) => audit as Record<string, any>).filter((audit) => audit.metadata?.storageAction === 'expiry_set');
      expect(dated.map((audit) => audit.metadata.expiresAt)).toEqual(['2026-12-31', null]);
    });

    it('removes uploads left unfinished for three days, leaves recent and stored ones, and still lets a retry resume', async () => {
      const { service, store } = await localService();
      const stored = await storeClientFile(service, 'evt_1', 'kept.pdf');
      const abandonedTarget = target('evt_1');
      const abandoned = await service.requestUpload({ eventId: 'evt_1', ownerRecordType: 'event', ownerRecordId: 'evt_1', logicalTarget: abandonedTarget, usage: 'client_document', fileName: 'never-sent.pdf', contentType: 'application/pdf', declaredByteSize: bytes.byteLength, checksumSha256, actor: clientAccount });
      const recent = await service.requestUpload({ eventId: 'evt_1', ownerRecordType: 'event', ownerRecordId: 'evt_1', logicalTarget: target('evt_1'), usage: 'client_document', fileName: 'still-uploading.pdf', contentType: 'application/pdf', declaredByteSize: bytes.byteLength, checksumSha256, actor: clientAccount });
      store.objects.find((object) => object.id === recent.object.id)!.updatedAt = new Date('2026-09-11T00:00:00.000Z');
      store.objects.push({ ...store.objects.find((object) => object.id === abandoned.object.id)!, id: 'obj_failed', logicalTarget: target('evt_1'), lifecycleState: 'failed', failureReason: 'Storage provider could not issue an upload location', providerObjectKey: null });

      await expect(service.cleanUpAbandonedUploads(new Date('2026-09-12T00:00:00.000Z'))).resolves.toBe(2);
      const state = (id: string) => store.objects.find((object) => object.id === id)?.lifecycleState;
      expect([state(abandoned.object.id), state('obj_failed'), state(recent.object.id), state(stored.id)]).toEqual(['deleted', 'deleted', 'requested', 'stored']);
      const removed = store.auditWriter.write.mock.calls.map(([audit]) => audit as Record<string, any>).filter((audit) => audit.metadata?.storageAction === 'abandoned_removed');
      expect(removed).toHaveLength(2);
      await expect(service.cleanUpAbandonedUploads(new Date('2026-09-12T00:00:00.000Z'))).resolves.toBe(0);

      // The client tries the same upload again later: it starts over instead of being refused.
      const retried = await service.requestUpload({ eventId: 'evt_1', ownerRecordType: 'event', ownerRecordId: 'evt_1', logicalTarget: abandonedTarget, usage: 'client_document', fileName: 'never-sent.pdf', contentType: 'application/pdf', declaredByteSize: bytes.byteLength, checksumSha256, actor: clientAccount });
      expect(retried).toMatchObject({ status: 'ready', object: { id: abandoned.object.id, lifecycleState: 'requested' } });
    });

    it("refuses a copy into someone else's event, under another event's target, or of a file the client cannot download", async () => {
      const { service, store } = await localService();
      const source = await storeClientFile(service, 'evt_1', 'venue-permit.pdf');
      store.statements.push({ id: 'bill_unsent', sentAt: null });
      store.objects.push({ ...store.objects[0], id: 'obj_unsent', ownerRecordType: 'billing_statement', ownerRecordId: 'bill_unsent', usage: 'event_deliverable', logicalTarget: 'billing-statement:bill_unsent' });

      await expect(service.copyToClientEvent({ sourceObjectId: source.id, eventId: 'evt_3', logicalTarget: target('evt_3'), actor: clientAccount })).rejects.toThrow(ForbiddenException);
      await expect(service.copyToClientEvent({ sourceObjectId: source.id, eventId: 'evt_2', logicalTarget: target('evt_1'), actor: clientAccount })).rejects.toThrow(ForbiddenException);
      await expect(service.copyToClientEvent({ sourceObjectId: 'obj_unsent', eventId: 'evt_2', logicalTarget: target('evt_2'), actor: clientAccount })).rejects.toThrow(NotFoundException);
      expect(store.objects.filter((object) => object.eventId === 'evt_2' || object.eventId === 'evt_3')).toHaveLength(0);
    });

    it("searches only the client's own events by file name, and only within the event an event-scoped session names", async () => {
      const { service, store } = await localService();
      await storeClientFile(service, 'evt_1', 'Venue-Permit-2025.pdf');
      await storeClientFile(service, 'evt_2', 'venue-permit-2026.pdf');
      await storeClientFile(service, 'evt_2', 'menu.pdf');
      store.objects.push({ ...store.objects[0], id: 'obj_foreign', eventId: 'evt_3', originalFileName: 'venue-permit-other-client.pdf' });

      const matches = await service.searchClientObjects(clientAccount, ' PERMIT ');
      expect(matches.map((object) => object.originalFileName).sort()).toEqual(['Venue-Permit-2025.pdf', 'venue-permit-2026.pdf']);
      expect((await service.searchClientObjects(clientAccount, '')).map((object) => object.eventId).sort()).toEqual(['evt_1', 'evt_2', 'evt_2']);
      expect((await service.searchClientObjects(client, 'permit')).map((object) => object.eventId)).toEqual(['evt_1']);
      await expect(service.searchClientObjects(actor, 'permit')).rejects.toThrow(ForbiddenException);
    });
  });
});
