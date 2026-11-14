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
export const STORED_RECEIPT_EVIDENCE_READER = Symbol('STORED_RECEIPT_EVIDENCE_READER');
export const GUEST_FEEDBACK_MEDIA_STORE = Symbol('GUEST_FEEDBACK_MEDIA_STORE');
export const STORED_COMMUNICATION_ATTACHMENT_READER = Symbol('STORED_COMMUNICATION_ATTACHMENT_READER');
export const COMMUNICATION_ATTACHMENT_GATE = Symbol('COMMUNICATION_ATTACHMENT_GATE');

export type GuestFeedbackMediaReference = {
  id: string;
  originalFileName: string;
  contentType: string;
  byteSize: number;
};

/**
 * New-SEC3: guest feedback photos and videos. Guests have no session, so the guest-code route checks the access
 * code and feedback window first; the store then checks size, checksum and file signature before storing bytes.
 */
export interface GuestFeedbackMediaStore {
  storeGuestFeedbackMedia(input: { eventId: string; fileName: string; contentType: string; bytes: Uint8Array }): Promise<GuestFeedbackMediaReference>;
  findStoredGuestFeedbackMedia(input: { eventId: string; objectId: string }): Promise<GuestFeedbackMediaReference | null>;
}

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
  logicalTarget: string;
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
  /** When each of these stored files of the event stops being valid; files with no expiry are absent. */
  findStoredFileExpiries(input: { eventId: string; objectIds: string[] }): Promise<Map<string, Date>>;
}

export type StoredReceiptEvidence = { objectId: string; fileName: string; contentType: string; byteSize: number };

/** Commercial binds proof of payment to a receipt only through verified stored bytes uploaded for that exact receipt. */
export interface StoredReceiptEvidenceReader {
  /** The confirmed object, only if it was uploaded as evidence for this receipt of this event. */
  findConfirmedReceiptEvidence(input: { eventId: string; receiptId: string; objectId: string }): Promise<StoredReceiptEvidence | null>;
  /** Display facts for evidence already bound to receipts; an object that was deleted or never confirmed is absent. */
  describeReceiptEvidence(objectIds: string[]): Promise<Map<string, StoredReceiptEvidence>>;
}

/** A conversation attachment as the message send verifies it: who uploaded it, and where it belongs. */
export type StoredCommunicationAttachmentRecord = {
  id: string;
  eventId: string;
  ownerRecordType: string;
  ownerRecordId: string;
  usage: string;
  lifecycleState: string;
  uploaderActorId: string;
  fileName: string;
  contentType: string;
  byteSize: number;
};

/** Display facts for an attachment in a message. */
export type StoredCommunicationAttachment = { id: string; fileName: string; contentType: string; byteSize: number };

/** Communication verifies attachments under its thread lock and reads their display facts; storage owns the bytes. */
export interface StoredCommunicationAttachmentReader {
  findStoredCommunicationAttachments(input: { objectIds: string[]; context?: PrismTransactionContext }): Promise<Map<string, StoredCommunicationAttachmentRecord>>;
  /** Attachments that are stored and not deleted; any other object is absent. */
  describeCommunicationAttachments(objectIds: string[]): Promise<Map<string, StoredCommunicationAttachment>>;
}

/** What storage needs to know about a conversation to authorize a file in it. */
export type CommunicationThreadAccess = { eventId: string; closed: boolean; activeMember: boolean };

/** Commercial owns conversations; storage asks it, and never imports its service. */
export interface CommunicationAttachmentGate {
  findThreadAccess(input: { threadId: string; actorId: string }): Promise<CommunicationThreadAccess | null>;
  /** The given conversation files that no message has attached. Storage removes unsent files only through this answer. */
  unattachedObjectIds(objectIds: string[]): Promise<Set<string>>;
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
