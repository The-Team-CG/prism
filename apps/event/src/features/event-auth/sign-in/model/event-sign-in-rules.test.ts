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

  it("maps rejected roles to portal messages", () => {
    expect(eventRoleRejectionMessage("client")).toContain("3001");
    expect(eventRoleRejectionMessage("supplier")).toContain("3002");
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
