import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { UploadMetadataInput, ValidatedUploadMetadata } from '../application/files/document-vault.service';

export type SignedUploadUrlRequest = {
  eventId: string;
  actorRole: string;
  upload: UploadMetadataInput;
  prefix: string;
};

export type SignedUploadUrlResult = {
  upload: ValidatedUploadMetadata;
  uploadUrl: string;
  expiresAt: string;
  provider: string;
};

export interface SignedUploadUrlFactory {
  createSignedUploadUrl(request: SignedUploadUrlRequest): Promise<SignedUploadUrlResult>;
}

/**
 * @deprecated W10's canonical provider-neutral contract is
 * `platform-ops/contracts/storage/storage.port.ts`. This compatibility shim
 * remains only for callers that have not yet moved to the durable object
 * workflow; it is never bound as a storage provider.
 */
@Injectable()
export class MetadataOnlySignedUploadUrlFactory implements SignedUploadUrlFactory {
  async createSignedUploadUrl(_request: SignedUploadUrlRequest): Promise<SignedUploadUrlResult> {
    throw new ServiceUnavailableException('Signed upload URLs require an approved storage adapter');
  }
}
