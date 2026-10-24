import { describe, expect, it } from "vitest";
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

  it("routes non-client roles to their configured portals", () => {
    const env = {
      NEXT_PUBLIC_EVENT_PORTAL_URL: "http://localhost:3154",
      NEXT_PUBLIC_SUPPLIER_PORTAL_URL: "http://localhost:3152",
    };
    expect(portalMessage("supplier", env)).toContain("http://localhost:3152");
    expect(portalMessage("pmcm-admin", env)).toContain("http://localhost:3154");
    expect(portalMessage("guest", env)).toContain("approved client");
  });

  it("names the missing portal URL instead of falling back to a default origin", () => {
    expect(() => portalMessage("supplier", {})).toThrow("NEXT_PUBLIC_SUPPLIER_PORTAL_URL is required");
  });

  it("resolves post-sign-in path safely", () => {
    expect(resolvePostSignInPath("/dashboard/events")).toBe("/dashboard/events");
    expect(resolvePostSignInPath("https://evil.example")).toBe("/dashboard");
    expect(resolvePostSignInPath(null)).toBe("/dashboard");
  });

  it("maps invalid credentials without identifying a seeded account", () => {
    expect(mapSignInFailure({ message: "Invalid credentials" })).toContain("approved client account");
  });
});
