import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismAuthenticatedSession } from "@prism/types";
import { supplierAuthRepository } from "../data/supplier-auth-repository";
import { resumeSupplierCookieSession, signInSupplier, verifySupplierSignInCode } from "./supplier-sign-in";

const supplierSession: PrismAuthenticatedSession = {
  id: "supplier_1",
  name: "Supplier User",
  email: "supplier@example.test",
  role: "supplier",
  organization: "Supplier Co",
  approvalStatus: "approved",
  accessToken: "verified-supplier-token",
  expiresAt: "2099-09-30T12:00:00.000Z",
  signedInAt: "2026-09-30T04:00:00.000Z",
};

describe("signInSupplier", () => {
  afterEach(() => vi.restoreAllMocks());

  it("persists the authenticated session returned by the API", async () => {
    const signedIn = { ...supplierSession, privacyNoticeRequired: false };
    const login = vi.spyOn(supplierAuthRepository, "login").mockResolvedValue(signedIn);
    const saveSession = vi.spyOn(supplierAuthRepository, "saveSession");

    const result = await signInSupplier({
      draft: { email: "supplier@example.test", password: "supplier-password" },
      nextPath: "/dashboard/quotes",
    });

    expect(login).toHaveBeenCalledWith({
      email: "supplier@example.test",
      password: "supplier-password",
    });
    expect(saveSession).toHaveBeenCalledWith(signedIn);
    expect(result).toEqual({ session: signedIn, redirectTo: "/dashboard/quotes" });
  });

  it("asks for the authenticator code when the account has two-step sign-in on, then signs in with it", async () => {
    vi.spyOn(supplierAuthRepository, "login").mockResolvedValue({ kind: "two_factor_required", token: "two-step-token" });
    const verify = vi.spyOn(supplierAuthRepository, "verifyTwoStep").mockResolvedValue({ ...supplierSession, privacyNoticeRequired: false });
    const saveSession = vi.spyOn(supplierAuthRepository, "saveSession");

    await expect(signInSupplier({ draft: { email: "supplier@example.test", password: "supplier-password" } }))
      .resolves.toEqual({ twoStepToken: "two-step-token" });
    expect(saveSession).not.toHaveBeenCalled();

    await expect(verifySupplierSignInCode({ token: "two-step-token", code: "246810", nextPath: "/dashboard/quotes" }))
      .resolves.toMatchObject({ redirectTo: "/dashboard/quotes" });
    expect(verify).toHaveBeenCalledWith("two-step-token", "246810");
    expect(saveSession).toHaveBeenCalledTimes(1);
  });

  it("sends PMCM accounts to the event portal, whether they need two-step setup or pass the code", async () => {
    vi.spyOn(supplierAuthRepository, "login").mockResolvedValue({ kind: "two_factor_setup_required", token: "setup-token" });
    vi.spyOn(supplierAuthRepository, "verifyTwoStep").mockResolvedValue({ ...supplierSession, role: "pmcm-admin", privacyNoticeRequired: false });
    const saveSession = vi.spyOn(supplierAuthRepository, "saveSession");
    const endRejectedSession = vi.spyOn(supplierAuthRepository, "endRejectedSession").mockResolvedValue();

    await expect(signInSupplier({ draft: { email: "pmcm@example.test", password: "pmcm-password" } })).rejects.toThrow("event command portal");
    await expect(verifySupplierSignInCode({ token: "two-step-token", code: "246810" })).rejects.toThrow("event command portal");
    expect(saveSession).not.toHaveBeenCalled();
    // The session the API opened for the turned-away account is ended, so it does not stay live on the server.
    expect(endRejectedSession).toHaveBeenCalledWith("verified-supplier-token");
  });
});

describe("resumeSupplierCookieSession (signed in on the shared sign-in page)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("continues with the supplier session the API's cookie holds, and ignores anyone else's", async () => {
    vi.spyOn(supplierAuthRepository, "hasSignedInSession").mockReturnValue(false);
    const cookieSession = vi.spyOn(supplierAuthRepository, "cookieSession").mockResolvedValue({ ...supplierSession, accessToken: "", privacyNoticeRequired: true });
    const saveSession = vi.spyOn(supplierAuthRepository, "saveSession").mockImplementation(() => undefined);

    await expect(resumeSupplierCookieSession("/dashboard/quotes")).resolves.toMatchObject({ redirectTo: expect.stringContaining("/privacy") });
    expect(saveSession).toHaveBeenCalledTimes(1);

    cookieSession.mockResolvedValue({ ...supplierSession, role: "client", accessToken: "", privacyNoticeRequired: false });
    await expect(resumeSupplierCookieSession(null)).resolves.toBeNull();
    cookieSession.mockResolvedValue(null);
    await expect(resumeSupplierCookieSession(null)).resolves.toBeNull();
    expect(saveSession).toHaveBeenCalledTimes(1);
  });
});
