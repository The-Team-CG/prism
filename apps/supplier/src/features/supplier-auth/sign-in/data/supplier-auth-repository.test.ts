import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismApiError } from "@prism/api-client";
import { PRISM_PRIVACY_NOTICE_VERSION } from "@prism/types";

const auth = vi.hoisted(() => ({
  login: vi.fn(),
  requestApproval: vi.fn(),
  requestPasswordReset: vi.fn(),
  consumePasswordReset: vi.fn(),
  activateAccount: vi.fn(),
  acknowledgePrivacyNotice: vi.fn(),
}));

vi.mock("@prism/api-client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@prism/api-client")>();
  return { ...original, createEventOpsClient: vi.fn(() => ({ auth })) };
});

import { supplierAuthRepository } from "./supplier-auth-repository";
import { ActivationTokenRejectedError } from "../../activate/model/activate-model";
import { SUPPLIER_AUTH_API_OFFLINE_MESSAGE } from "../model/supplier-sign-in-rules";

const token = "a".repeat(43);

describe("supplier auth repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports the API's message, or the offline message when the API is unreachable", async () => {
    auth.login.mockRejectedValueOnce(new PrismApiError(401, { message: "Email or password is incorrect." }));
    await expect(supplierAuthRepository.login({ email: "ops@xperto.test", password: "wrong-password" }))
      .rejects.toThrow("Email or password is incorrect.");

    auth.login.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(supplierAuthRepository.login({ email: "ops@xperto.test", password: "wrong-password" }))
      .rejects.toThrow(SUPPLIER_AUTH_API_OFFLINE_MESSAGE);
  });

  it("validates reset input before calling the API", async () => {
    expect(() => supplierAuthRepository.requestPasswordReset({ email: "not-an-email" })).toThrow("Password reset request failed validation");
    expect(auth.requestPasswordReset).not.toHaveBeenCalled();

    auth.requestPasswordReset.mockResolvedValueOnce({ message: "sent" });
    await supplierAuthRepository.requestPasswordReset({ email: "ops@xperto.test" });
    expect(auth.requestPasswordReset).toHaveBeenCalledWith("ops@xperto.test");

    auth.consumePasswordReset.mockResolvedValueOnce({ message: "updated" });
    await supplierAuthRepository.consumePasswordReset({ token, password: "Prism-Demo-2026!" });
    expect(auth.consumePasswordReset).toHaveBeenCalledWith(token, "Prism-Demo-2026!");
  });

  it("turns a rejected activation token into the expired-link state", async () => {
    auth.activateAccount.mockRejectedValueOnce(new PrismApiError(400, { message: "Invalid or expired token." }));
    await expect(supplierAuthRepository.activateAccount({ token, password: "Prism-Demo-2026!" }))
      .rejects.toBeInstanceOf(ActivationTokenRejectedError);

    auth.activateAccount.mockResolvedValueOnce({ message: "ok" });
    await expect(supplierAuthRepository.activateAccount({ token, password: "Prism-Demo-2026!" })).resolves.toBeUndefined();
  });

  it("acknowledges the current privacy notice version", async () => {
    auth.acknowledgePrivacyNotice.mockResolvedValueOnce(undefined);
    await supplierAuthRepository.acknowledgePrivacyNotice();
    expect(auth.acknowledgePrivacyNotice).toHaveBeenCalledWith({ version: PRISM_PRIVACY_NOTICE_VERSION });
  });
});
