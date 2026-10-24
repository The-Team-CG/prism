import { describe, expect, it } from "vitest";
import {
  eventRoleRejectionMessage,
  isEventPortalRole,
  isSignInDraftValid,
  resolveEventPostSignInPath,
} from "./event-sign-in-rules";

describe("event-sign-in-rules", () => {
  it("allows only PMCM admin and coordinator roles", () => {
    expect(isEventPortalRole("pmcm-admin")).toBe(true);
    expect(isEventPortalRole("coordinator")).toBe(true);
    expect(isEventPortalRole("client")).toBe(false);
    expect(isEventPortalRole("supplier")).toBe(false);
  });

  it("maps rejected roles to their configured portal messages", () => {
    const env = {
      NEXT_PUBLIC_CLIENT_PORTAL_URL: "http://localhost:3151",
      NEXT_PUBLIC_SUPPLIER_PORTAL_URL: "http://localhost:3152",
    };
    expect(eventRoleRejectionMessage("client", env)).toContain("http://localhost:3151");
    expect(eventRoleRejectionMessage("supplier", env)).toContain("http://localhost:3152");
  });

  it("names the missing portal URL instead of falling back to a default origin", () => {
    expect(() => eventRoleRejectionMessage("client", {})).toThrow("NEXT_PUBLIC_CLIENT_PORTAL_URL is required");
  });

  it("resolves safe post-login paths", () => {
    expect(resolveEventPostSignInPath("/dashboard/tasks")).toBe("/dashboard/tasks");
    expect(resolveEventPostSignInPath("https://evil.test")).toBe("/dashboard");
  });

  it("validates draft credentials", () => {
    expect(isSignInDraftValid("a@b.c", "x")).toBe(true);
    expect(isSignInDraftValid(" ", "x")).toBe(false);
  });
});
