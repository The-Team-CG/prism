import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ForbiddenException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalFileSystemStorageAdapter } from '../../infrastructure/storage/local-filesystem-storage.adapter';
import { StorageObjectService } from './storage-object.service';
import { StorageValidationService } from './storage-validation.service';

const actor = { id: 'user_pmcm', role: 'pmcm-admin', name: 'PMCM Admin', explicit: true, verified: true } as never;
const client = { id: 'user_client', role: 'client', email: 'client@example.test', name: 'Client', eventId: 'evt_1', explicit: true, verified: true } as never;

function createStore() {
  const objects: Array<Record<string, any>> = [];
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
      findUnique: vi.fn(async () => ({ id: 'evt_1', clientName: 'Client', clientPortalStatus: 'unlocked', inquiry: { email: 'client@example.test' }, supplierQuoteRequests: [] })),
    },
  };
  const accessPolicy = {
    requireActorRole: vi.fn(async (candidate: { role: string }, roles: readonly string[], resource: string) => {
      if (!roles.includes(candidate.role)) throw new ForbiddenException(`${candidate.role} cannot access ${resource}`);
    }),
    requireCanReadEvent: vi.fn(async () => undefined),
    recordForbiddenAccess: vi.fn(async () => undefined),
  };
  const platformReferences = {
    findStorageEventScope: vi.fn(async (eventId: string) => eventId === 'evt_1' ? ({
      id: 'evt_1', clientName: 'Client', clientPortalStatus: 'unlocked', clientEmail: 'client@example.test', supplierIds: [] as string[],
    }) : null),
  };
  return {
    objects,
    prisma,
    accessPolicy,
    platformReferences,
    service: new StorageObjectService(prisma as never, accessPolicy as never, new StorageValidationService(), undefined, platformReferences as never),
  };
}

const bytes = Buffer.from('provider-neutral storage bytes');
const checksumSha256 = createHash('sha256').update(bytes).digest('hex');
const request = {
  eventId: 'evt_1', ownerRecordType: 'billing_statement', ownerRecordId: 'bill_1', logicalTarget: 'billing-statement:bill_1', usage: 'event_deliverable' as const,
  fileName: 'signed.pdf', contentType: 'application/pdf', declaredByteSize: bytes.byteLength, checksumSha256,
};

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe('StorageObjectService', () => {
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
    const stored = await service.confirmUpload({ objectId: requested.object.id, byteSize: bytes.byteLength, checksumSha256, bytes, actor });
    expect(stored).toMatchObject({ lifecycleState: 'stored', providerName: 'local-filesystem-development' });
    const authorization = await service.issueDownloadAuthorization({ objectId: stored.id, actor });
    await expect(adapter.readBytes(authorization.downloadUrl)).resolves.toEqual(bytes);
    await expect(service.deleteObject({ objectId: stored.id, actor })).resolves.toMatchObject({ lifecycleState: 'deleted' });
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

  it('rejects confirmation metadata that differs from the request declaration', async () => {
    const store = createStore();
    const adapter = { requestUploadLocation: vi.fn(async (input: { providerObjectKey: string }) => ({ providerName: 'test', providerObjectKey: input.providerObjectKey, uploadUrl: 'test://upload', expiresAt: new Date(Date.now() + 1000) })), confirmUpload: vi.fn(), issueDownloadAuthorization: vi.fn(), deleteObject: vi.fn() };
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), adapter, store.platformReferences as never);
    const requested = await service.requestUpload({ ...request, actor });
    if (requested.status !== 'ready') throw new Error('expected upload location');
    await expect(service.confirmUpload({ objectId: requested.object.id, byteSize: bytes.byteLength, checksumSha256: 'c'.repeat(64), actor })).rejects.toThrow(/does not match/);
    expect(store.objects[0].lifecycleState).toBe('requested');
  });

  it('denies a client downloading an object outside the actor event scope', async () => {
    const store = createStore();
    store.objects.push({ id: 'obj_other', eventId: 'evt_other', ownerRecordType: 'billing_statement', ownerRecordId: 'bill_other', usage: 'event_deliverable', lifecycleState: 'stored', providerObjectKey: 'events/evt_other/obj.pdf', contentType: 'application/pdf', declaredByteSize: 1, checksumSha256: 'a'.repeat(64), originalFileName: 'obj.pdf' });
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), {} as never, store.platformReferences as never);
    await expect(service.issueDownloadAuthorization({ objectId: 'obj_other', actor: client })).rejects.toThrow(/outside|forbidden|scope/);
  });

  it('derives supplier event access from the read-model supplier scope', async () => {
    const store = createStore();
    const supplier = { id: 'supplier-user', role: 'supplier', supplierId: 'sup_1', eventId: 'evt_1', name: 'Supplier', explicit: true, verified: true } as never;
    store.platformReferences.findStorageEventScope.mockResolvedValue({
      id: 'evt_1', clientName: 'Client', clientPortalStatus: 'unlocked', clientEmail: 'client@example.test', supplierIds: ['sup_1'],
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
    await expect(service.issueDownloadAuthorization({ objectId: 'obj_supplier', actor: client })).rejects.toThrow(/owner reference is not supported/);
  });

  it('denies a supplier deleting an object even when the event is in scope', async () => {
    const store = createStore();
    store.objects.push({ id: 'obj_supplier', eventId: 'evt_1', ownerRecordType: 'billing_statement', ownerRecordId: 'bill_1', usage: 'event_deliverable', lifecycleState: 'stored', providerObjectKey: 'events/evt_1/supplier.pdf', contentType: 'application/pdf', declaredByteSize: 1, checksumSha256: 'a'.repeat(64), originalFileName: 'supplier.pdf' });
    const supplier = { id: 'supplier-user', role: 'supplier', supplierId: 'sup_1', eventId: 'evt_1', name: 'Supplier', explicit: true } as never;
    const service = new StorageObjectService(store.prisma as never, store.accessPolicy as never, new StorageValidationService(), {} as never, store.platformReferences as never);
    await expect(service.deleteObject({ objectId: 'obj_supplier', actor: supplier })).rejects.toThrow(/cannot access/);
  });
});
