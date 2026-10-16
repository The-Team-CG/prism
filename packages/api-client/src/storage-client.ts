import type {
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
