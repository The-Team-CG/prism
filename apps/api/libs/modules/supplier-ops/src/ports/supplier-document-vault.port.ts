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

export interface SupplierDocumentVault {
  validateUploadMetadata(input: UploadMetadataInput, prefix: string): ValidatedUploadMetadata;
}
