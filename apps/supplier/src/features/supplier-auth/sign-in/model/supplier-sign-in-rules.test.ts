import { describe, expect, it } from "vitest";
import {
  approvalRequestPayload,
  buildSupplierSession,
  isExistingSupplierSession,
  isSupplierRole,
  isSupplierSignInDraftValid,
  mapWrongPortalMessage,
  PRIVACY_NOTICE_VERSION,
  resolvePostSignInPath,
} from "./supplier-sign-in-rules";
import type { SupplierSession } from "./supplier-sign-in-types";

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

  it("builds session with signedInAt", () => {
    const session = buildSupplierSession(
      {
        id: "s1",
        name: "Ops Lead",
        email: "ops@xperto.test",
        role: "supplier",
        organization: "Xperto",
      },
      "2026-07-01T00:00:00.000Z",
    );
    expect(session.signedInAt).toBe("2026-07-01T00:00:00.000Z");
    expect(session.email).toBe("ops@xperto.test");
  });

  it("resolves post sign-in path safely", () => {
    expect(resolvePostSignInPath("/dashboard")).toBe("/dashboard");
    expect(resolvePostSignInPath("https://evil.example")).toBe("/dashboard");
    expect(resolvePostSignInPath(null)).toBe("/dashboard");
  });

  it("detects existing supplier sessions", () => {
    const ok: SupplierSession = {
      id: "1",
      name: "Ops",
      email: "ops@xperto.test",
      role: "supplier",
      organization: "Xperto",
      signedInAt: "2026-07-01T00:00:00.000Z",
    };
    expect(isExistingSupplierSession(ok)).toBe(true);
    expect(isExistingSupplierSession({ ...ok, role: "client" })).toBe(false);
    expect(isExistingSupplierSession(null)).toBe(false);
  });

  it("builds approval request payload", () => {
    expect(approvalRequestPayload("ops@xperto.test", true)).toEqual({
      email: "ops@xperto.test",
      privacyConsentAccepted: true,
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      marketingConsentAccepted: false,
    });
  });
});
