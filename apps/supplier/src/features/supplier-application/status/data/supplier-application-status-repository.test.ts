import { describe, expect, it } from "vitest";
import { PrismApiError } from "@prism/api-client";
import { normalizeSupplierApplicationStatusRequestError } from "./supplier-application-status-repository";

describe("supplier application status repository error normalization", () => {
  it("maps API not-found to a domain failure without leaking transport details", () => {
    const failure = normalizeSupplierApplicationStatusRequestError(
      new PrismApiError(404, { message: "application sap_secret not found" }),
    );

    expect(failure.failure).toBe("not_found");
    expect(failure.message).toBe("not_found");
  });

  it("maps other API and connection failures to an unavailable domain failure", () => {
    expect(normalizeSupplierApplicationStatusRequestError(new PrismApiError(503, "offline")).failure)
      .toBe("unavailable");
    expect(normalizeSupplierApplicationStatusRequestError(new TypeError("Failed to fetch")).failure)
      .toBe("unavailable");
  });
});
