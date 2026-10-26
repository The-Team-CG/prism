import { describe, expect, it } from "vitest";
import { wrongPortalLinks } from "@/lib/portal-urls";
import {
  isClientRole,
  isSignInDraftValid,
  mapSignInFailure,
  portalMessage,
  resolvePostSignInPath,
} from "./sign-in-rules";

describe("sign-in-rules", () => {
  it("validates draft credentials", () => {
    expect(isSignInDraftValid({ email: "a@b.c", password: "x" })).toBe(true);
    expect(isSignInDraftValid({ email: "  ", password: "x" })).toBe(false);
    expect(isSignInDraftValid({ email: "a@b.c", password: "" })).toBe(false);
  });

  it("accepts only client role", () => {
    expect(isClientRole("client")).toBe(true);
    expect(isClientRole("supplier")).toBe(false);
  });

  it("routes non-client roles to the configured portal URLs and names a missing one", () => {
    const env = {
      NEXT_PUBLIC_CLIENT_PORTAL_URL: "http://localhost:3151",
      NEXT_PUBLIC_SUPPLIER_PORTAL_URL: "http://localhost:3152",
      NEXT_PUBLIC_GUEST_PORTAL_URL: "http://localhost:3153",
      NEXT_PUBLIC_EVENT_PORTAL_URL: "http://localhost:3154",
    };
    expect(portalMessage("supplier", env)).toContain("http://localhost:3152");
    expect(portalMessage("pmcm-admin", env)).toContain("http://localhost:3154");
    expect(portalMessage("guest", env)).toContain("approved client");
    expect(() => portalMessage("pmcm-admin", { ...env, NEXT_PUBLIC_EVENT_PORTAL_URL: undefined })).toThrow(
      "NEXT_PUBLIC_EVENT_PORTAL_URL is required",
    );
  });

  it("resolves post-sign-in path safely", () => {
    expect(resolvePostSignInPath("/dashboard/events")).toBe("/dashboard/events");
    expect(resolvePostSignInPath("/dashboard?tab=files")).toBe("/dashboard?tab=files");
    for (const unsafe of ["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "%2F%2Fevil.example"]) {
      expect(resolvePostSignInPath(unsafe)).toBe("/dashboard");
    }
    expect(resolvePostSignInPath(null)).toBe("/dashboard");
  });

  it("maps invalid credentials without identifying a seeded account", () => {
    expect(mapSignInFailure({ message: "Invalid credentials" })).toContain("approved client account");
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
    expect(wrongPortalLinks("client", env)).toEqual([
      { label: "Supplier portal", href: "https://s.example/sign-in" },
      { label: "Guest portal", href: "https://g.example/sign-in" },
      { label: "Event portal", href: "https://e.example/sign-in" },
    ]);
    expect(() => wrongPortalLinks("client", { ...env, NEXT_PUBLIC_GUEST_PORTAL_URL: "  " })).toThrow(
      "NEXT_PUBLIC_GUEST_PORTAL_URL is required",
    );
  });
});
