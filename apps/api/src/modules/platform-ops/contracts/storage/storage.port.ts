import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type {
  ConfirmStorageUploadInput,
  PrismStoredObject,
  RequestStorageUploadInput,
  StorageUsage,
} from '@prism/types';

export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');

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
};

export type StorageDownloadAuthorization = {
  providerName: string;
  providerObjectKey: string;
  downloadUrl: string;
  expiresAt: Date;
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

export type StorageServiceDeletion = StorageServiceDownload & { context?: PrismTransactionContext };
