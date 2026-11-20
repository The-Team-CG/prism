import { afterEach, describe, expect, it, vi } from "vitest";
import { logoutEventSession } from "./session-commands";

describe("event session commands", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("ends the server session through the API's /api/auth/logout route", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4000");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await logoutEventSession();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://localhost:4000/api/auth/logout");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
  });
});
