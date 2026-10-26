import { afterEach, describe, expect, it, vi } from "vitest";
import { supplierAuthRepository } from "../../sign-in/data/supplier-auth-repository";
import { ACTIVATION_INVALID_COPY, ActivationTokenRejectedError } from "../model/activate-model";
import { activateSupplierAccount } from "./activate";

describe("activateSupplierAccount", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects a short or missing token as an invalid link without calling the API", async () => {
    const activate = vi.spyOn(supplierAuthRepository, "activateAccount").mockResolvedValue(undefined);

    for (const token of ["", "short-token"]) {
      const attempt = activateSupplierAccount({ token, password: "a-valid-password-123" });
      await expect(attempt).rejects.toBeInstanceOf(ActivationTokenRejectedError);
      await expect(attempt).rejects.toThrow(ACTIVATION_INVALID_COPY);
    }
    expect(activate).not.toHaveBeenCalled();
  });
});
