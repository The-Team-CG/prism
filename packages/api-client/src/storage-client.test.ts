import { afterEach, describe, expect, it, vi } from "vitest";
import { copyStorageObject, searchClientStoredFiles, setStorageObjectExpiry, uploadStorageObject } from "./storage-client";

afterEach(() => vi.unstubAllGlobals());

const fileBytes = new TextEncoder().encode("%PDF-1.7\nverified client upload");

async function sha256(bytes: Uint8Array) {
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const hash = await globalThis.crypto.subtle.digest("SHA-256", copy);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function storedObject(checksumSha256: string) {
  return {
    id: "obj_1", eventId: "evt_1", usage: "client_document", lifecycleState: "stored",
    originalFileName: "client.pdf", contentType: "application/pdf", declaredByteSize: fileBytes.byteLength, checksumSha256,
  };
}

function uploadRequestResponse() {
  return new Response(JSON.stringify({
    status: "ready", object: { id: "obj_1" },
    location: { uploadUrl: "https://storage.example/signed-once", expiresAt: "2026-10-16T12:00:00.000Z" },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("storage byte transport", () => {
  it("sends actual bytes to the signed URL without leaking the API bearer and confirms their hash", async () => {
    const checksumSha256 = await sha256(fileBytes);
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(uploadRequestResponse())
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(storedObject(checksumSha256)), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const file = new File([fileBytes], "client.pdf", { type: "application/pdf" });
    const result = await uploadStorageObject(file, {
      eventId: "evt_1", ownerRecordType: "event", ownerRecordId: "evt_1",
      logicalTarget: "client-upload:evt_1:123e4567-e89b-42d3-a456-426614174000", usage: "client_document",
    }, { authToken: "client-session", baseUrl: "https://api.example/api" });

    expect(result.id).toBe("obj_1");
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { checksumSha256: string; declaredByteSize: number };
    expect(requestBody).toMatchObject({ checksumSha256, declaredByteSize: fileBytes.byteLength });
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe("Bearer client-session");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://storage.example/signed-once");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("PUT");
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).has("Authorization")).toBe(false);
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get("Authorization")).toBe("Bearer client-session");
  });

  it("confirms after an ambiguous provider response so a successful one-use upload can be recovered", async () => {
    const checksumSha256 = await sha256(fileBytes);
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(uploadRequestResponse())
      .mockResolvedValueOnce(new Response("upload response lost", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(storedObject(checksumSha256)), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const file = new File([fileBytes], "client.pdf", { type: "application/pdf" });
    const result = await uploadStorageObject(file, {
      eventId: "evt_1", ownerRecordType: "event", ownerRecordId: "evt_1",
      logicalTarget: "client-upload:evt_1:123e4567-e89b-42d3-a456-426614174000", usage: "client_document",
    }, { authToken: "client-session", baseUrl: "https://api.example/api" });

    expect(result.lifecycleState).toBe("stored");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[0]).toBe("https://api.example/api/storage/objects/obj_1/confirm");
  });
});

describe("client file copy and search", () => {
  it("asks the API to copy a file into another event and searches the client's files, with the bearer and encoded inputs", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await copyStorageObject("obj/1", { eventId: "evt_2", logicalTarget: "client-upload:evt_2:123e4567-e89b-42d3-a456-426614174000" }, { authToken: "token", baseUrl: "http://api.test/api" });
    await searchClientStoredFiles("venue permit & co", { authToken: "token", baseUrl: "http://api.test/api" });
    await setStorageObjectExpiry("obj/1", { expiresAt: "2026-12-31" }, { authToken: "token", baseUrl: "http://api.test/api" });

    const [[copyUrl, copyInit], [searchUrl, searchInit], [expiryUrl, expiryInit]] = fetchMock.mock.calls as Array<[string, RequestInit]>;
    expect([expiryInit.method, expiryUrl, JSON.parse(String(expiryInit.body))]).toEqual(["PUT", "http://api.test/api/storage/objects/obj%2F1/expiry", { expiresAt: "2026-12-31" }]);
    expect([copyInit.method, copyUrl]).toEqual(["POST", "http://api.test/api/storage/objects/obj%2F1/copies"]);
    expect(JSON.parse(String(copyInit.body))).toEqual({ eventId: "evt_2", logicalTarget: "client-upload:evt_2:123e4567-e89b-42d3-a456-426614174000" });
    expect(searchUrl).toBe("http://api.test/api/storage/objects/client-files?query=venue+permit+%26+co");
    expect([copyInit, searchInit].every((init) => (init.headers as Record<string, string>).Authorization === "Bearer token")).toBe(true);
  });
});
