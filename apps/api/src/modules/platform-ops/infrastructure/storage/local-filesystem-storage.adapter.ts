import { BadRequestException, ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import type {
  StorageAdapter,
  StorageAdapterConfirmRequest,
  StorageAdapterRequest,
  StorageConfirmation,
  StorageDownloadAuthorization,
  StorageUploadLocation,
} from '../../contracts/storage/storage.port';

type LocalAuthorization = { kind: 'upload' | 'download'; objectKey: string; expiresAt: number };

/** Development-only adapter. It must never be used as production object storage. */
@Injectable()
export class LocalFileSystemStorageAdapter implements StorageAdapter {
  readonly providerName = 'local-filesystem-development';
  private readonly authorizations = new Map<string, LocalAuthorization>();
  private readonly rootDirectory: string;

  constructor(rootDirectory: string) {
    if (!rootDirectory.trim()) throw new Error('A local storage directory is required');
    this.rootDirectory = resolve(rootDirectory);
  }

  async requestUploadLocation(input: StorageAdapterRequest): Promise<StorageUploadLocation> {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const token = this.issueAuthorization('upload', input.providerObjectKey, expiresAt);
    return {
      providerName: this.providerName,
      providerObjectKey: input.providerObjectKey,
      uploadUrl: `localfs://upload/${token}`,
      expiresAt,
    };
  }

  async confirmUpload(input: StorageAdapterConfirmRequest): Promise<StorageConfirmation> {
    if (input.bytes) {
      const checksumSha256 = createHash('sha256').update(input.bytes).digest('hex');
      if (input.bytes.byteLength !== input.byteSize || checksumSha256 !== input.checksumSha256.toLowerCase()) {
        throw new BadRequestException('Uploaded bytes do not match the declared size or checksum');
      }
      await this.ensureObjectBytes(input.providerObjectKey, input.bytes);
    } else {
      await this.statObject(input.providerObjectKey);
    }
    return {
      providerName: this.providerName,
      providerObjectKey: input.providerObjectKey,
      byteSize: input.byteSize,
      checksumSha256: input.checksumSha256.toLowerCase(),
    };
  }

  async issueDownloadAuthorization(input: StorageAdapterRequest): Promise<StorageDownloadAuthorization> {
    await this.statObject(input.providerObjectKey);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const token = this.issueAuthorization('download', input.providerObjectKey, expiresAt);
    return {
      providerName: this.providerName,
      providerObjectKey: input.providerObjectKey,
      downloadUrl: `localfs://download/${token}`,
      expiresAt,
    };
  }

  async deleteObject(input: Pick<StorageAdapterRequest, 'objectId' | 'providerObjectKey'>) {
    try {
      await rm(this.safePath(input.providerObjectKey), { force: false });
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (code === 'ENOENT') return;
      throw error;
    }
    for (const [token, authorization] of this.authorizations) {
      if (authorization.objectKey === input.providerObjectKey) this.authorizations.delete(token);
    }
  }

  /** Resolve an upload URL issued by this adapter and persist real bytes atomically. */
  async writeBytes(uploadUrl: string, bytes: Uint8Array) {
    const authorization = this.resolveAuthorization(uploadUrl, 'upload');
    await this.writeObject(authorization.objectKey, bytes);
  }

  /** Resolve a download URL issued by this adapter and return the stored bytes. */
  async readBytes(downloadUrl: string) {
    const authorization = this.resolveAuthorization(downloadUrl, 'download');
    try {
      return await readFile(this.safePath(authorization.objectKey));
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (code === 'ENOENT') throw new NotFoundException('Stored object is not available');
      throw error;
    }
  }

  private async writeObject(objectKey: string, bytes: Uint8Array) {
    const path = this.safePath(objectKey);
    try {
      await readFile(path);
      throw new ConflictException('Storage object already exists');
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (code !== 'ENOENT') throw error;
    }
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.part`;
    await writeFile(temporary, bytes, { flag: 'wx' });
    try {
      await rename(temporary, path);
    } catch (error) {
      await rm(temporary, { force: true });
      throw new ConflictException('Storage object already exists');
    }
  }

  private async ensureObjectBytes(objectKey: string, bytes: Uint8Array) {
    try {
      const existing = await readFile(this.safePath(objectKey));
      if (existing.byteLength === bytes.byteLength && createHash('sha256').update(existing).digest('hex') === createHash('sha256').update(bytes).digest('hex')) return;
      throw new ConflictException('Storage object already exists with different bytes');
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (code !== 'ENOENT') throw error;
      await this.writeObject(objectKey, bytes);
    }
  }

  private async statObject(objectKey: string) {
    try {
      return await readFile(this.safePath(objectKey));
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (code === 'ENOENT') throw new NotFoundException('Uploaded object was not found');
      throw error;
    }
  }

  private safePath(objectKey: string) {
    const normalized = objectKey.replaceAll('\\', '/');
    if (!normalized || isAbsolute(normalized) || normalized.split('/').some((part) => part === '..' || part === '.')) {
      throw new BadRequestException('Invalid storage object key');
    }
    const path = resolve(join(this.rootDirectory, normalized));
    if (path !== this.rootDirectory && !path.startsWith(`${this.rootDirectory}${sep}`)) {
      throw new BadRequestException('Invalid storage object key');
    }
    return path;
  }

  private issueAuthorization(kind: LocalAuthorization['kind'], objectKey: string, expiresAt: Date) {
    this.safePath(objectKey);
    const token = randomUUID();
    this.authorizations.set(token, { kind, objectKey, expiresAt: expiresAt.getTime() });
    return token;
  }

  private resolveAuthorization(url: string, kind: LocalAuthorization['kind']) {
    const prefix = `localfs://${kind}/`;
    if (!url.startsWith(prefix)) throw new GoneException('Storage authorization is invalid or expired');
    const token = url.slice(prefix.length);
    const authorization = this.authorizations.get(token);
    if (!authorization || authorization.kind !== kind || authorization.expiresAt <= Date.now()) {
      this.authorizations.delete(token);
      throw new GoneException('Storage authorization is invalid or expired');
    }
    return authorization;
  }
}
