import { describe, expect, it } from "vitest";
import { canManageGuestQrPasses } from "./guest-qr-access";

describe("guest QR pass access", () => {
  it.each([
    ["pmcm-admin", true],
    ["system", true],
    ["coordinator", false],
    ["supplier", false],
    ["client", false],
  ])("allows role %s only when it can manage PMCM guest passes", (role, allowed) => {
    expect(canManageGuestQrPasses(role)).toBe(allowed);
  });
});
