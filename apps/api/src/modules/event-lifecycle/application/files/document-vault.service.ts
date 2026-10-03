import { Injectable } from '@nestjs/common';
import { validateUploadMetadata } from '@prism/kernel/shared';
import type {
  DocumentVault,
  UploadMetadataInput,
  UploadValidationOptions,
  ValidatedUploadMetadata,
} from '../../contracts/document-vault.port';

export type { UploadMetadataInput, UploadValidationOptions, ValidatedUploadMetadata } from '../../contracts/document-vault.port';

@Injectable()
export class DocumentVaultService implements DocumentVault {
  validateUploadMetadata(
    input: UploadMetadataInput,
    prefix: string,
    options: UploadValidationOptions = {},
  ): ValidatedUploadMetadata {
    return validateUploadMetadata(input, prefix, options);
  }
}
