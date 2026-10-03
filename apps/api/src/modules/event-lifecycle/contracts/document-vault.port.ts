import type {
  DocumentReferenceLookup,
  DocumentRetentionPolicy,
  PrismDocumentReference,
  RegisterLifecycleDocumentInput,
} from '@prism/types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export const DOCUMENT_VAULT = Symbol('DOCUMENT_VAULT');

export type UploadMetadataInput = {
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
};

export type ValidatedUploadMetadata = {
  originalFileName: string;
  generatedFileName: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storageKey: string;
  validationStatus: 'accepted';
};

export type UploadValidationOptions = {
  maxSizeBytes?: number;
  allowedMimeTypes?: readonly string[];
};

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
