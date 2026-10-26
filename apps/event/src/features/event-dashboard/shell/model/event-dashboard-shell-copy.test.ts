import { describe, expect, it } from "vitest";
import { wrongEventPortalCopy } from "./event-dashboard-shell-copy";

const env = {
  NEXT_PUBLIC_CLIENT_PORTAL_URL: "https://client.example/",
  NEXT_PUBLIC_SUPPLIER_PORTAL_URL: "https://supplier.example",
  NEXT_PUBLIC_GUEST_PORTAL_URL: "https://guest.example",
  NEXT_PUBLIC_EVENT_PORTAL_URL: "https://event.example",
};

describe("wrongEventPortalCopy", () => {
  it("names the configured client or supplier portal for non-PMCM roles", () => {
    expect(wrongEventPortalCopy("client", env)).toBe(
      "Client accounts belong in the client portal at https://client.example/.",
    );
    expect(wrongEventPortalCopy("supplier", env)).toBe(
      "Supplier accounts belong in the supplier portal at https://supplier.example.",
    );
  });

  it("names the missing portal URL instead of linking to a default origin", () => {
    expect(() => wrongEventPortalCopy("client", { ...env, NEXT_PUBLIC_CLIENT_PORTAL_URL: "" })).toThrow(
      "NEXT_PUBLIC_CLIENT_PORTAL_URL is required",
    );
  });
});
