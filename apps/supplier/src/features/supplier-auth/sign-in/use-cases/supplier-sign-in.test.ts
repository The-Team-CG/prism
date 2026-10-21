import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismAuthenticatedSession } from "@prism/types";
import { supplierAuthRepository } from "../data/supplier-auth-repository";
import { signInSupplier } from "./supplier-sign-in";

const supplierSession: PrismAuthenticatedSession = {
  id: "supplier_1",
  name: "Supplier User",
  email: "supplier@example.test",
  role: "supplier",
  organization: "Supplier Co",
  approvalStatus: "approved",
  accessToken: "verified-supplier-token",
  expiresAt: "2026-09-30T12:00:00.000Z",
  signedInAt: "2026-09-30T04:00:00.000Z",
};

describe("signInSupplier", () => {
  afterEach(() => vi.restoreAllMocks());

  it("persists the authenticated session returned by the API", async () => {
    const login = vi.spyOn(supplierAuthRepository, "login").mockResolvedValue(supplierSession);
    const saveSession = vi.spyOn(supplierAuthRepository, "saveSession");

    const result = await signInSupplier({
      draft: { email: "supplier@example.test", password: "supplier-password" },
      nextPath: "/dashboard/quotes",
    });

    expect(login).toHaveBeenCalledWith({
      email: "supplier@example.test",
      password: "supplier-password",
    });
    expect(saveSession).toHaveBeenCalledWith(supplierSession);
    expect(result).toEqual({ session: supplierSession, redirectTo: "/dashboard/quotes" });
  });

  it("sends PMCM two-factor responses to the event portal", async () => {
    vi.spyOn(supplierAuthRepository, "login").mockResolvedValue({
      kind: "two_factor_required",
      token: "two-factor-token",
    });
    const saveSession = vi.spyOn(supplierAuthRepository, "saveSession");

    await expect(
      signInSupplier({ draft: { email: "pmcm@example.test", password: "pmcm-password" } }),
    ).rejects.toThrow("event command portal");
    expect(saveSession).not.toHaveBeenCalled();
  });
});
