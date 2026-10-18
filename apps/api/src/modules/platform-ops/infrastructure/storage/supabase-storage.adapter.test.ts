import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseStorageAdapter } from './supabase-storage.adapter';

afterEach(() => vi.unstubAllGlobals());

describe('SupabaseStorageAdapter', () => {
  it('issues a one-use signed upload for the exact object key without enabling overwrite', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_input, _init) => new Response(JSON.stringify({ url: '/object/upload/sign/private/events/evt_1/objects/client_document/obj_1.pdf?token=single-use' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new SupabaseStorageAdapter('https://project.supabase.co', 'server-key', 'private');
    const startedAt = Date.now();
    const result = await adapter.requestUploadLocation({
      objectId: 'obj_1', eventId: 'evt_1', usage: 'client_document', contentType: 'application/pdf', byteSize: 100,
      checksumSha256: 'a'.repeat(64), providerObjectKey: 'events/evt_1/objects/client_document/obj_1.pdf',
    });

    expect(result.uploadUrl).toBe('https://project.supabase.co/storage/v1/object/upload/sign/private/events/evt_1/objects/client_document/obj_1.pdf?token=single-use');
    expect(result.expiresAt.getTime() - startedAt).toBeGreaterThan(2 * 60 * 60 * 1000 - 2_000);
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has('x-upsert')).toBe(false);
  });

  it.each([
    ['external origin', 'https://attacker.example/storage/v1/object/upload/sign/private/events/evt_1/objects/client_document/obj_1.pdf?token=bad'],
    ['wrong bucket', 'https://project.supabase.co/storage/v1/object/upload/sign/other/events/evt_1/objects/client_document/obj_1.pdf?token=bad'],
    ['wrong object', 'https://project.supabase.co/storage/v1/object/upload/sign/private/events/evt_1/objects/client_document/other.pdf?token=bad'],
  ])('rejects a signed upload URL with %s', async (_caseName, signedUrl) => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ signedURL: signedUrl }), { status: 200 })));
    const adapter = new SupabaseStorageAdapter('https://project.supabase.co', 'server-key', 'private');

    await expect(adapter.requestUploadLocation({
      objectId: 'obj_1', eventId: 'evt_1', usage: 'client_document', contentType: 'application/pdf', byteSize: 100,
      checksumSha256: 'a'.repeat(64), providerObjectKey: 'events/evt_1/objects/client_document/obj_1.pdf',
    })).rejects.toThrow('invalid signed upload URL');
  });

  it('accepts a Supabase signed download URL only for the configured private object path', async () => {
    const signedUrl = 'https://project.supabase.co/storage/v1/object/sign/private/events/evt_1/objects/client_document/obj_1.pdf?token=single-use';
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ signedURL: signedUrl }), { status: 200 })));
    const adapter = new SupabaseStorageAdapter('https://project.supabase.co', 'server-key', 'private');

    const result = await adapter.issueDownloadAuthorization({
      objectId: 'obj_1', eventId: 'evt_1', usage: 'client_document', contentType: 'application/pdf', byteSize: 100,
      checksumSha256: 'a'.repeat(64), providerObjectKey: 'events/evt_1/objects/client_document/obj_1.pdf',
    });

    expect(result.downloadUrl).toBe(signedUrl);
  });

  it('reads back actual private provider bytes and computes their content hash during confirmation', async () => {
    const bytes = Buffer.from('%PDF-1.7\nprovider bytes');
    const fetchMock = vi.fn<typeof fetch>(async (_input, _init) => new Response(bytes, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new SupabaseStorageAdapter('https://project.supabase.co', 'server-key', 'private');
    const result = await adapter.confirmUpload({
      objectId: 'obj_1', eventId: 'evt_1', usage: 'client_document', contentType: 'application/pdf',
      byteSize: bytes.byteLength, checksumSha256: createHash('sha256').update(bytes).digest('hex'),
      providerObjectKey: 'events/evt_1/objects/client_document/obj_1.pdf',
    });

    expect(result).toMatchObject({ providerName: 'supabase-storage', byteSize: bytes.byteLength, checksumSha256: createHash('sha256').update(bytes).digest('hex') });
    expect(Array.from(result.observedBytes ?? [])).toEqual(Array.from(bytes));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/object/authenticated/private/events/evt_1/objects/client_document/obj_1.pdf');
  });
});
