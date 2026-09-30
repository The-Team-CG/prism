import { describe, expect, it } from "vitest";
import type { PrismAuthenticatedSession } from "@prism/types";
import { PRISM_PRIVACY_NOTICE_VERSION } from "@prism/types";
import {
  approvalRequestPayload,
  isExistingSupplierSession,
  isSupplierRole,
  isSupplierSignInDraftValid,
  mapWrongPortalMessage,
  resolvePostSignInPath,
} from "./supplier-sign-in-rules";

describe("supplier-sign-in-rules", () => {
  it("validates sign-in draft", () => {
    expect(isSupplierSignInDraftValid({ email: "a@b.com", password: "x" })).toBe(true);
    expect(isSupplierSignInDraftValid({ email: "  ", password: "x" })).toBe(false);
    expect(isSupplierSignInDraftValid({ email: "a@b.com", password: "" })).toBe(false);
  });

  it("checks supplier role", () => {
    expect(isSupplierRole("supplier")).toBe(true);
    expect(isSupplierRole("client")).toBe(false);
  });

  it("maps wrong portal messages", () => {
    expect(mapWrongPortalMessage("client")).toContain("client portal");
    expect(mapWrongPortalMessage("admin")).toContain("event command portal");
  });

  it("resolves post sign-in path safely", () => {
    expect(resolvePostSignInPath("/dashboard")).toBe("/dashboard");
    expect(resolvePostSignInPath("https://evil.example")).toBe("/dashboard");
    expect(resolvePostSignInPath(null)).toBe("/dashboard");
  });

  it("detects existing supplier sessions", () => {
    const ok: PrismAuthenticatedSession = {
      id: "1",
      name: "Ops",
      email: "ops@xperto.test",
      role: "supplier",
      organization: "Xperto",
      approvalStatus: "approved",
      signedInAt: "2026-07-01T00:00:00.000Z",
      accessToken: "supplier-token",
      expiresAt: "2026-07-02T00:00:00.000Z",
    };
    expect(isExistingSupplierSession(ok)).toBe(true);
    expect(isExistingSupplierSession({ ...ok, role: "client" })).toBe(false);
    expect(isExistingSupplierSession(null)).toBe(false);
  });

  it("builds approval request payload", () => {
    expect(approvalRequestPayload("ops@xperto.test", true)).toEqual({
      email: "ops@xperto.test",
      privacyConsentAccepted: true,
      privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
      marketingConsentAccepted: false,
    });
    expect(() => approvalRequestPayload("ops@xperto.test", false)).toThrow(
      "Privacy consent is required before requesting supplier account approval",
    );
  });
});
