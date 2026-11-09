/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { inquiryRepository } from "./inquiry-repository";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("inquiry repository", () => {
  it("addresses an edit link by its encoded token under the API prefix", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await inquiryRepository.getEdit("token/with space");

    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/api\/public-inquiries\/edit\/token%2Fwith%20space$/);
  });
});
