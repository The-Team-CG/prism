import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { UploadMetadataInput, ValidatedUploadMetadata } from '../services/document-vault.service';

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

@Injectable()
export class MetadataOnlySignedUploadUrlFactory implements SignedUploadUrlFactory {
  async createSignedUploadUrl(): Promise<SignedUploadUrlResult> {
    throw new ServiceUnavailableException('Signed upload URLs require an approved storage adapter');
  }
}