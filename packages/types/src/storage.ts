import type { StorageUsage } from "./schemas/storage.js";
export type { StorageUsage } from "./schemas/storage.js";

export interface PrismStoredObject {
  id: string;
  eventId: string;
  ownerRecordType: string;
  ownerRecordId: string;
  logicalTarget: string;
  usage: StorageUsage;
  originalFileName: string;
  contentType: string;
  declaredByteSize: number;
  checksumSha256: string;
  uploaderActorId: string;
  uploaderActorRole: string;
  lifecycleState: "requested" | "stored" | "failed" | "deleted";
  providerName: string | null;
  providerObjectKey: string | null;
  failureReason: string | null;
  requestedAt: string;
  storedAt: string | null;
  failedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrismStorageUploadLocation {
  providerName: string;
  providerObjectKey: string;
  uploadUrl: string;
  expiresAt: string;
}

export type PrismStorageUploadRequestResult =
  | { status: "ready"; object: PrismStoredObject; location: PrismStorageUploadLocation }
  | { status: "stored"; object: PrismStoredObject }
  | { status: "failed"; object: PrismStoredObject; reason: string };

export interface PrismStorageDownloadAuthorization {
  providerName: string;
  providerObjectKey: string;
  downloadUrl: string;
  expiresAt: string;
  fileName: string;
  contentType: string;
  byteSize: number;
}
