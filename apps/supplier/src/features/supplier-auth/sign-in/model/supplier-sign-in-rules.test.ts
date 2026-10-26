import { describe, expect, it } from "vitest";
import { wrongPortalLinks } from "@/lib/portal-urls";
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
    expect(resolvePostSignInPath("/dashboard?tab=files")).toBe("/dashboard?tab=files");
    for (const unsafe of ["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "%2F%2Fevil.example"]) {
      expect(resolvePostSignInPath(unsafe)).toBe("/dashboard");
    }
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

describe("wrongPortalLinks", () => {
  const env = {
    NEXT_PUBLIC_CLIENT_PORTAL_URL: "https://c.example/",
    NEXT_PUBLIC_SUPPLIER_PORTAL_URL: "https://s.example",
    NEXT_PUBLIC_GUEST_PORTAL_URL: "https://g.example",
    NEXT_PUBLIC_EVENT_PORTAL_URL: "https://e.example",
  };

  it("links to the other portals' sign-in pages and names a missing portal URL", () => {
    expect(wrongPortalLinks("supplier", env)).toEqual([
      { label: "Client portal", href: "https://c.example/sign-in" },
      { label: "Guest portal", href: "https://g.example/sign-in" },
      { label: "Event portal", href: "https://e.example/sign-in" },
    ]);
    expect(() => wrongPortalLinks("supplier", { ...env, NEXT_PUBLIC_GUEST_PORTAL_URL: "  " })).toThrow(
      "NEXT_PUBLIC_GUEST_PORTAL_URL is required",
    );
  });
});
