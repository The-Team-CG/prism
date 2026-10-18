import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  StorageAdapter,
  StorageAdapterConfirmRequest,
  StorageAdapterRequest,
  StorageConfirmation,
  StorageDownloadAuthorization,
  StorageUploadLocation,
} from '../../contracts/storage/storage.port';

type SupabaseStorageResponse = {
  url?: string;
  signedURL?: string;
  signedUrl?: string;
  token?: string;
};

/** Private-bucket Supabase Storage adapter. Credentials are server-only and are never returned to clients. */
@Injectable()
export class SupabaseStorageAdapter implements StorageAdapter {
  readonly providerName = 'supabase-storage';
  private readonly baseUrl: string;
  private readonly projectOrigin: string;

  constructor(
    projectUrl: string,
    private readonly serviceRoleKey: string,
    private readonly bucket: string,
  ) {
    if (!projectUrl.trim() || !serviceRoleKey.trim() || !bucket.trim()) {
      throw new Error('Supabase Storage URL, service role key, and bucket are required');
    }
    const parsedProjectUrl = new URL(projectUrl);
    this.projectOrigin = parsedProjectUrl.origin;
    this.baseUrl = `${projectUrl.replace(/\/+$/, '')}/storage/v1`;
  }

  async requestUploadLocation(input: StorageAdapterRequest): Promise<StorageUploadLocation> {
    const path = this.objectPath(input.providerObjectKey);
    const response = await this.request(`/object/upload/sign/${this.encodedBucket()}/${path}`, {
      method: 'POST',
    });
    const data = await this.readJson(response);
    return {
      providerName: this.providerName,
      providerObjectKey: input.providerObjectKey,
      uploadUrl: this.resolveSignedUrl(data.signedURL ?? data.signedUrl ?? data.url, input.providerObjectKey, 'upload'),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    };
  }

  async confirmUpload(input: StorageAdapterConfirmRequest): Promise<StorageConfirmation> {
    const response = await this.request(`/object/authenticated/${this.encodedBucket()}/${this.objectPath(input.providerObjectKey)}`, { method: 'GET' });
    const observedBytes = new Uint8Array(await response.arrayBuffer());
    const checksumSha256 = createHash('sha256').update(observedBytes).digest('hex');
    return {
      providerName: this.providerName,
      providerObjectKey: input.providerObjectKey,
      byteSize: observedBytes.byteLength,
      checksumSha256,
      observedBytes,
    };
  }

  async issueDownloadAuthorization(input: StorageAdapterRequest): Promise<StorageDownloadAuthorization> {
    const path = this.objectPath(input.providerObjectKey);
    const response = await this.request(`/object/sign/${this.encodedBucket()}/${path}`, {
      method: 'POST',
      body: JSON.stringify({ expiresIn: 15 * 60 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await this.readJson(response);
    return {
      providerName: this.providerName,
      providerObjectKey: input.providerObjectKey,
      downloadUrl: this.resolveSignedUrl(data.signedURL ?? data.signedUrl ?? data.url, input.providerObjectKey),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }

  async deleteObject(input: { objectId: string; providerObjectKey: string }) {
    const response = await this.request(`/object/${this.encodedBucket()}`, {
      method: 'DELETE',
      body: JSON.stringify({ prefixes: [this.objectPath(input.providerObjectKey)] }),
      headers: { 'Content-Type': 'application/json' },
    });
    await response.arrayBuffer();
  }

  private async request(path: string, init: RequestInit) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        ...(init.headers ?? {}),
      },
    });
    if (!response.ok) {
      await response.arrayBuffer().catch(() => undefined);
      throw new Error(`Supabase Storage request failed (${response.status})`);
    }
    return response;
  }

  private async readJson(response: Response): Promise<SupabaseStorageResponse> {
    return response.json() as Promise<SupabaseStorageResponse>;
  }

  private resolveSignedUrl(value: string | undefined, objectKey: string, kind: 'upload' | 'download' = 'download') {
    if (!value) throw new Error(`Supabase Storage did not return a signed ${kind} URL for ${objectKey}`);

    const relativePath = value.replace(/^\/+/, '');
    const candidate = /^https?:\/\//i.test(value)
      ? new URL(value)
      : value.startsWith('/object/')
        ? new URL(`${this.baseUrl}/${relativePath}`)
        : new URL(value, `${this.baseUrl}/`);
    const expectedEndpoint = kind === 'upload' ? 'object/upload/sign' : 'object/sign';
    const expectedPath = new URL(`${this.baseUrl}/${expectedEndpoint}/${this.encodedBucket()}/${this.objectPath(objectKey)}`).pathname;
    const decodePath = (pathname: string) => pathname.split('/').map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return null;
      }
    });

    if (
      candidate.origin !== this.projectOrigin ||
      candidate.username ||
      candidate.password ||
      candidate.hash ||
      JSON.stringify(decodePath(candidate.pathname)) !== JSON.stringify(decodePath(expectedPath))
    ) {
      throw new Error(`Supabase Storage returned an invalid signed ${kind} URL for ${objectKey}`);
    }
    return candidate.toString();
  }

  private encodedBucket() {
    return encodeURIComponent(this.bucket);
  }

  private objectPath(path: string) {
    return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  }
}
