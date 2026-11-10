import { PrismApiError, PrismApiOfflineError } from "@prism/api-client";
import { describe, expect, it } from "vitest";

import { GUEST_API_OFFLINE_MESSAGE, GuestApiError, guestCall } from "./guest-http";

describe("guestCall", () => {
  it("returns what the request returns", async () => {
    await expect(guestCall(async () => ({ id: "pass_1" }))).resolves.toEqual({ id: "pass_1" });
  });

  it("keeps the server's message, joining a list of them, and says which request failed when it sent none", async () => {
    const refusal = (status: number, body: unknown) => () => Promise.reject(new PrismApiError(status, body));

    await expect(guestCall(refusal(404, { message: "Access code not found" }), "Event code was not found")).rejects.toMatchObject({ status: 404, message: "Access code not found" });
    await expect(guestCall(refusal(400, { message: ["Name is required", "Consent is required"] }))).rejects.toMatchObject({ status: 400, message: "Name is required, Consent is required" });
    await expect(guestCall(refusal(404, {}), "Event code was not found")).rejects.toMatchObject({ status: 404, message: "Event code was not found: 404" });
    await expect(guestCall(refusal(500, "<html>Bad gateway</html>"))).rejects.toMatchObject({ status: 500, message: "Request failed: 500" });
    await expect(guestCall(refusal(410, { message: "" }), "Event ended")).rejects.toBeInstanceOf(GuestApiError);
  });

  it("lets an unreachable API through with the guest offline message, and any other error unchanged", async () => {
    await expect(guestCall(() => Promise.reject(new PrismApiOfflineError()))).rejects.toThrow(GUEST_API_OFFLINE_MESSAGE);
    const unexpected = new RangeError("boom");
    await expect(guestCall(() => Promise.reject(unexpected))).rejects.toBe(unexpected);
  });
});
