import type { UploadMetadataInput } from '@prism/types';
import type { UploadValidationOptions, ValidatedUploadMetadata } from '@prism/kernel/shared';
import type {
  DocumentReferenceLookup,
  DocumentRetentionPolicy,
  PrismDocumentReference,
  RegisterLifecycleDocumentInput,
} from '@prism/types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export const DOCUMENT_VAULT = Symbol('DOCUMENT_VAULT');

export type { UploadMetadataInput, UploadValidationOptions, ValidatedUploadMetadata };

export interface DocumentVault {
  validateUploadMetadata(
    input: UploadMetadataInput,
    prefix: string,
    options?: UploadValidationOptions,
  ): ValidatedUploadMetadata;

  registerDocument(
    input: RegisterLifecycleDocumentInput,
    context?: PrismTransactionContext,
  ): Promise<PrismDocumentReference>;

  findEligibleReference(
    input: DocumentReferenceLookup,
    context?: PrismTransactionContext,
  ): Promise<PrismDocumentReference>;

  getRetentionPolicy(): DocumentRetentionPolicy;
}
