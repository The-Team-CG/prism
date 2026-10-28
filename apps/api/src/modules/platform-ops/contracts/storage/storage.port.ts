import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type {
  ConfirmStorageUploadInput,
  PrismStoredObject,
  RequestStorageUploadInput,
  StorageUsage,
} from '@prism/types';

export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');
export const STORED_SUPPLIER_UPLOAD_READER = Symbol('STORED_SUPPLIER_UPLOAD_READER');
export const STORED_REQUIREMENT_UPLOAD_READER = Symbol('STORED_REQUIREMENT_UPLOAD_READER');

export type StoredSupplierUploadReference = {
  id: string;
  originalFileName: string;
  contentType: string;
  declaredByteSize: number;
  checksumSha256: string;
};

export type StoredSupplierUploadLookup = {
  objectId: string;
  eventId: string;
  supplierId: string;
  logicalTargetPrefix: string;
  checksumSha256?: string;
};

/** Narrow storage-owner capability for commercial supplier workflow attachments. */
export interface StoredSupplierUploadReader {
  findConfirmedSupplierUpload(input: StoredSupplierUploadLookup): Promise<StoredSupplierUploadReference | null>;
}

export type StoredRequirementUploadReference = {
  id: string;
  eventId: string;
  ownerRecordType: string;
  ownerRecordId: string;
  usage: StorageUsage;
  lifecycleState: StorageLifecycleState;
  originalFileName: string;
  contentType: string;
  declaredByteSize: number;
  uploaderActorId: string;
  uploaderActorRole: string;
};

/** Lifecycle may bind only verified stored bytes from the same event to an event requirement. */
export interface StoredRequirementUploadReader {
  findStoredRequirementUpload(input: { eventId: string; objectId: string; context?: PrismTransactionContext }): Promise<StoredRequirementUploadReference | null>;
}

export type StorageLifecycleState = PrismStoredObject['lifecycleState'];

export type StorageUploadLocation = {
  providerName: string;
  providerObjectKey: string;
  uploadUrl: string;
  expiresAt: Date;
};

export type StorageConfirmation = {
  providerName: string;
  providerObjectKey: string;
  byteSize: number;
  checksumSha256: string;
  observedBytes?: Uint8Array;
};

export type StorageDownloadAuthorization = {
  providerName: string;
  providerObjectKey: string;
  downloadUrl: string;
  expiresAt: Date;
};

export type StorageObjectDownloadResult = StorageDownloadAuthorization & {
  fileName: string;
  contentType: string;
  byteSize: number;
};

export type StorageAdapterRequest = {
  objectId: string;
  eventId: string;
  usage: StorageUsage;
  contentType: string;
  byteSize: number;
  checksumSha256: string;
  providerObjectKey: string;
};

export type StorageAdapterConfirmRequest = StorageAdapterRequest & {
  /** Local development uses these bytes; external adapters may confirm provider metadata. */
  bytes?: Uint8Array;
};

export interface StorageAdapter {
  requestUploadLocation(input: StorageAdapterRequest): Promise<StorageUploadLocation>;
  confirmUpload(input: StorageAdapterConfirmRequest): Promise<StorageConfirmation>;
  issueDownloadAuthorization(input: StorageAdapterRequest): Promise<StorageDownloadAuthorization>;
  deleteObject(input: Pick<StorageAdapterRequest, 'objectId' | 'providerObjectKey'>): Promise<void>;
  /** Adapter-specific byte bridge for development providers with non-HTTP upload URLs. */
  writeAuthorizedUpload?(uploadUrl: string, expectedObjectKey: string, contentType: string, bytes: Uint8Array): Promise<void>;
  /** Adapter-specific byte bridge for development providers with non-HTTP download URLs. */
  readAuthorizedDownload?(downloadUrl: string, expectedObjectKey: string): Promise<Uint8Array>;
}

export type StorageRequestResult =
  | { status: 'ready'; object: PrismStoredObject; location: StorageUploadLocation }
  | { status: 'stored'; object: PrismStoredObject }
  | { status: 'failed'; object: PrismStoredObject; reason: string };

export type StorageServiceRequest = RequestStorageUploadInput & {
  actor: ResolvedEventOpsActor;
  context?: PrismTransactionContext;
};

export type StorageServiceConfirmation = ConfirmStorageUploadInput & {
  objectId: string;
  actor: ResolvedEventOpsActor;
  bytes?: Uint8Array;
  context?: PrismTransactionContext;
};

export type StorageServiceDownload = {
  objectId: string;
  actor: ResolvedEventOpsActor;
};

export type StorageServiceByteUpload = StorageServiceDownload & {
  uploadUrl: string;
  bytes: Uint8Array;
};

export type StorageServiceByteDownload = StorageServiceDownload & {
  downloadUrl: string;
};

export type StorageServiceDeletion = StorageServiceDownload & { context?: PrismTransactionContext };
