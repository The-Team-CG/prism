import { afterEach, describe, expect, it, vi } from "vitest";
import { PRISM_SESSION_STORAGE_KEYS, type PrismAuthenticatedSession } from "@prism/types";
import { supplierWorkspaceRepository } from "../data/supplier-workspace-repository";
import { signOutSupplier } from "./supplier-workspace-actions";

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

function stubBrowserStorage(initial: Record<string, string>) {
  const items = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
    },
  });
  return items;
}

describe("signOutSupplier", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["the logout request succeeds", () => Promise.resolve()],
    ["the logout request is rejected", () => Promise.reject(new Error("Can't reach P.R.I.S.M right now."))],
  ])("clears the stored supplier session and resolves when %s", async (_case, logout) => {
    const items = stubBrowserStorage({
      [PRISM_SESSION_STORAGE_KEYS.supplier]: JSON.stringify(supplierSession),
    });
    const logoutRequest = vi.spyOn(supplierWorkspaceRepository, "logout").mockImplementation(logout);

    await expect(signOutSupplier()).resolves.toBeUndefined();

    expect(logoutRequest).toHaveBeenCalledOnce();
    expect(items.has(PRISM_SESSION_STORAGE_KEYS.supplier)).toBe(false);
  });
});
