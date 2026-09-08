import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalFileSystemStorageAdapter } from './local-filesystem-storage.adapter';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('LocalFileSystemStorageAdapter', () => {
  it('round-trips real bytes through an expiring upload and download authorization, then deletes them', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prism-storage-'));
    roots.push(root);
    const adapter = new LocalFileSystemStorageAdapter(root);
    const bytes = Buffer.from(`real local bytes ${randomUUID()}`);
    const checksumSha256 = createHash('sha256').update(bytes).digest('hex');
    const request = {
      objectId: 'obj_test', eventId: 'evt_test', usage: 'event_deliverable' as const, contentType: 'application/pdf', byteSize: bytes.byteLength, checksumSha256, providerObjectKey: 'events/evt_test/objects/event_deliverable/obj_test.pdf',
    };
    const upload = await adapter.requestUploadLocation(request);
    await adapter.writeBytes(upload.uploadUrl, bytes);
    await expect(adapter.confirmUpload({ ...request, bytes })).resolves.toMatchObject({ byteSize: bytes.byteLength, checksumSha256 });
    const download = await adapter.issueDownloadAuthorization(request);
    await expect(adapter.readBytes(download.downloadUrl)).resolves.toEqual(bytes);
    await adapter.deleteObject({ objectId: request.objectId, providerObjectKey: request.providerObjectKey });
    await expect(adapter.readBytes(download.downloadUrl)).rejects.toThrow(/not available|invalid|expired/);
  });

  it('rejects checksum mismatch and oversize bytes before writing them', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prism-storage-'));
    roots.push(root);
    const adapter = new LocalFileSystemStorageAdapter(root);
    const bytes = Buffer.from('wrong bytes');
    const request = {
      objectId: 'obj_test', eventId: 'evt_test', usage: 'event_deliverable' as const, contentType: 'application/pdf', byteSize: bytes.byteLength + 1, checksumSha256: 'a'.repeat(64), providerObjectKey: 'events/evt_test/objects/event_deliverable/obj_test.pdf',
    };
    await expect(adapter.confirmUpload({ ...request, bytes })).rejects.toThrow(/size or checksum/);
    await expect(adapter.issueDownloadAuthorization({ ...request, byteSize: bytes.byteLength, checksumSha256: createHash('sha256').update(bytes).digest('hex') })).rejects.toThrow(/not found/);
  });
});
