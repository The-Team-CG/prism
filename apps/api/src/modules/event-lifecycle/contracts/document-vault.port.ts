import type { UploadMetadataInput } from '@prism/types';
import type { UploadValidationOptions, ValidatedUploadMetadata } from '@prism/kernel/shared';

export const DOCUMENT_VAULT = Symbol('DOCUMENT_VAULT');

export type { UploadMetadataInput, UploadValidationOptions, ValidatedUploadMetadata };

export interface DocumentVault {
  validateUploadMetadata(
    input: UploadMetadataInput,
    prefix: string,
    options?: UploadValidationOptions,
  ): ValidatedUploadMetadata;
}
