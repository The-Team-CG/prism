import { describe, expect, it } from "vitest";
import {
  findClientSampleUser,
  isClientRole,
  isSignInDraftValid,
  mapSignInFailure,
  portalMessage,
  resolvePostSignInPath,
  samplePasswordFor,
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

  it("routes non-client roles to their portals", () => {
    expect(portalMessage("supplier")).toContain("3002");
    expect(portalMessage("pmcm-admin")).toContain("3004");
    expect(portalMessage("guest")).toContain("approved client");
  });

  it("uses checkout-derived portal URLs when provided", () => {
    const env = {
      NEXT_PUBLIC_EVENT_PORTAL_URL: "http://localhost:3154",
      NEXT_PUBLIC_SUPPLIER_PORTAL_URL: "http://localhost:3152",
    };
    expect(portalMessage("pmcm-admin", env)).toContain("http://localhost:3154");
    expect(portalMessage("supplier", env)).toContain("http://localhost:3152");
  });

  it("resolves post-sign-in path safely", () => {
    expect(resolvePostSignInPath("/dashboard/events")).toBe("/dashboard/events");
    expect(resolvePostSignInPath("https://evil.example")).toBe("/dashboard");
    expect(resolvePostSignInPath(null)).toBe("/dashboard");
  });

  it("maps sample user approval failures", () => {
    const pending = {
      id: "u1",
      name: "Pending",
      email: "p@test.com",
      role: "client" as const,
      organization: "Org",
      approvalStatus: "pending" as const,
    };
    const mapped = mapSignInFailure({ message: "Invalid credentials", sampleUser: pending });
    expect(mapped.pendingUser).toEqual(pending);
    expect(mapped.error).toContain("waiting for approval");
  });

  it("finds sample users and passwords", () => {
    expect(findClientSampleUser("ana@ayala.test")?.name).toBe("Ana Reyes");
    expect(samplePasswordFor("ana@ayala.test")).toBe("prism-client");
  });
});
