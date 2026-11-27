import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventOpsClient } from "./event-ops-client";
import { enablePrismSessionCookies } from "./http";

// Its own file: turning cookie sessions on lasts for the module, like it does for a portal.
afterEach(() => vi.unstubAllGlobals());

describe("cookie sessions (sign-in redesign)", () => {
  it("sends the portal's session cookie on every call and treats a 401 as an expired sign-in without a stored token", async () => {
    enablePrismSessionCookies();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: "Session expired" }), { status: 401, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const onUnauthorized = vi.fn();
    const api = createEventOpsClient({ baseUrl: "http://api.test", getAuthToken: () => undefined, onUnauthorized });

    await expect(api.auth.me()).rejects.toMatchObject({ status: 401 });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.credentials).toBe("include");
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
