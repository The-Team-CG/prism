import type {
  CopyStorageObjectInput,
  CopyStorageObjectToThreadInput,
  SetStorageObjectExpiryInput,
  PrismStorageDownloadAuthorization,
  PrismStorageUploadLocation,
  PrismStorageUploadRequestResult,
  PrismStoredObject,
  RequestStorageUploadInput,
} from "@prism/types";
import { PrismApiError, prismRequest, resolvePrismApiBaseUrl } from "./http";

export interface StorageClientOptions {
  authToken?: string | null;
  baseUrl?: string;
}

export type StorageUploadIntent = Pick<
  RequestStorageUploadInput,
  "eventId" | "ownerRecordType" | "ownerRecordId" | "logicalTarget" | "usage" | "idempotencyKey"
>;

export interface StorageObjectDownload {
  blob: Blob;
  fileName: string;
  contentType: string;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

function fileContentType(file: File) {
  if (file.type) return file.type.toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

async function sha256(file: File) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function throwResponseError(response: Response) {
  const body = await response.json().catch(() => response.text().catch(() => ""));
  throw new PrismApiError(response.status, body);
}

function isApiUploadUrl(url: string) {
  return url.startsWith("localfs://") || url.startsWith("prismapi://");
}

async function uploadBytes(objectId: string, location: PrismStorageUploadLocation, file: File, options: StorageClientOptions, baseUrl: string, contentType: string) {
  const localUpload = isApiUploadUrl(location.uploadUrl);
  const target = localUpload
    ? `${baseUrl}/storage/objects/${encodeURIComponent(objectId)}/content`
    : location.uploadUrl;
  const headers = localUpload
    ? {
        "Content-Type": "application/octet-stream",
        "x-prism-storage-authorization": location.uploadUrl,
        ...(options.authToken ? { Authorization: `Bearer ${options.authToken}` } : {}),
      }
    : { "Content-Type": contentType };
  try {
    const result = await fetch(target, {
      method: localUpload ? "POST" : "PUT",
      headers,
      body: file,
    });
    if (!result.ok) await throwResponseError(result);
  } catch (error) {
    // Confirmation verifies the same bytes if the upload succeeded but its response was lost.
    return error;
  }
  return undefined;
}

/** Uploads the actual file bytes, then asks the API to verify and finalize the stored object. */
export async function uploadStorageObject(
  file: File,
  intent: StorageUploadIntent,
  options: StorageClientOptions = {},
): Promise<PrismStoredObject> {
  const contentType = fileContentType(file);
  const checksumSha256 = await sha256(file);
  const baseUrl = resolvePrismApiBaseUrl(options.baseUrl);
  const request = await prismRequest<PrismStorageUploadRequestResult>("/storage/objects/upload-request", {
    method: "POST",
    authToken: options.authToken,
    baseUrl,
    body: {
      ...intent,
      fileName: file.name,
      contentType,
      declaredByteSize: file.size,
      checksumSha256,
    },
  });

  if (request.status === "failed") throw new Error(request.reason);
  if (request.status === "stored") return request.object;

  if (request.status !== "ready") throw new Error("Unexpected storage upload state");
  const uploadError = await uploadBytes(request.object.id, request.location, file, options, baseUrl, contentType);

  try {
    return await prismRequest<PrismStoredObject>(`/storage/objects/${encodeURIComponent(request.object.id)}/confirm`, {
      method: "POST",
      authToken: options.authToken,
      baseUrl,
      body: { checksumSha256, byteSize: file.size },
    });
  } catch (error) {
    if (uploadError) throw uploadError;
    throw error;
  }
}

/** Retrieves bytes only after the API issues an event- and role-scoped authorization. */
export async function getStorageObjectDownload(
  objectId: string,
  options: StorageClientOptions = {},
): Promise<StorageObjectDownload> {
  const baseUrl = resolvePrismApiBaseUrl(options.baseUrl);
  const authorization = await prismRequest<PrismStorageDownloadAuthorization>(
    `/storage/objects/${encodeURIComponent(objectId)}/download-authorization`,
    { authToken: options.authToken, baseUrl },
  );
  const localFileSystem = authorization.downloadUrl.startsWith("localfs://");
  const response = await fetch(
    localFileSystem
      ? `${baseUrl}/storage/objects/${encodeURIComponent(objectId)}/content`
      : authorization.downloadUrl,
    {
      headers: {
        ...(localFileSystem ? { "x-prism-storage-authorization": authorization.downloadUrl } : {}),
        ...(localFileSystem && options.authToken ? { Authorization: `Bearer ${options.authToken}` } : {}),
      },
    },
  );
  if (!response.ok) await throwResponseError(response);
  return {
    blob: await response.blob(),
    fileName: authorization.fileName,
    contentType: authorization.contentType,
  };
}

/** Copies a stored file into another event as a new client document; the server moves the bytes. */
export function copyStorageObject(objectId: string, input: CopyStorageObjectInput, options: StorageClientOptions & { signal?: AbortSignal } = {}): Promise<PrismStoredObject> {
  return prismRequest<PrismStoredObject>(`/storage/objects/${encodeURIComponent(objectId)}/copies`, {
    method: "POST",
    authToken: options.authToken,
    baseUrl: resolvePrismApiBaseUrl(options.baseUrl),
    body: input,
    signal: options.signal,
  });
}

/** Sets or clears the last day a stored document is valid. */
export function setStorageObjectExpiry(objectId: string, input: SetStorageObjectExpiryInput, options: StorageClientOptions = {}): Promise<PrismStoredObject> {
  return prismRequest<PrismStoredObject>(`/storage/objects/${encodeURIComponent(objectId)}/expiry`, {
    method: "PUT",
    authToken: options.authToken,
    baseUrl: resolvePrismApiBaseUrl(options.baseUrl),
    body: input,
  });
}

/** The signed-in client's stored files across all of their events, matching a file name; an empty query lists the newest. */
export function searchClientStoredFiles(query: string, options: StorageClientOptions & { signal?: AbortSignal } = {}): Promise<PrismStoredObject[]> {
  const search = new URLSearchParams({ query });
  return prismRequest<PrismStoredObject[]>(`/storage/objects/client-files?${search.toString()}`, {
    authToken: options.authToken,
    baseUrl: resolvePrismApiBaseUrl(options.baseUrl),
    signal: options.signal,
  });
}

/** Uploads a file attached to a conversation. The conversation owns the stored copy; only its active members can read it. */
export function uploadCommunicationAttachment(
  file: File,
  target: { eventId: string; threadId: string },
  options: StorageClientOptions = {},
): Promise<PrismStoredObject> {
  return uploadStorageObject(file, {
    eventId: target.eventId,
    ownerRecordType: "communication_thread",
    ownerRecordId: target.threadId,
    logicalTarget: `communication-attachment:${target.threadId}:${globalThis.crypto.randomUUID()}`,
    usage: "communication_attachment",
  }, options);
}

/** Copies a stored file of the same event into a conversation as its attachment; the returned object id is the attachment id. */
export function copyStorageObjectToThread(objectId: string, input: CopyStorageObjectToThreadInput, options: StorageClientOptions & { signal?: AbortSignal } = {}): Promise<PrismStoredObject> {
  return prismRequest<PrismStoredObject>(`/storage/objects/${encodeURIComponent(objectId)}/thread-copies`, {
    method: "POST",
    authToken: options.authToken,
    baseUrl: resolvePrismApiBaseUrl(options.baseUrl),
    body: input,
    signal: options.signal,
  });
}
