import { activateAccountSchema } from "@prism/types";
import { supplierAuthRepository } from "../../sign-in/data/supplier-auth-repository";
import { ActivationTokenRejectedError } from "../model/activate-model";

export async function activateSupplierAccount(input: { token: string; password: string }): Promise<void> {
  const parsed = activateAccountSchema.safeParse(input);
  if (!parsed.success) {
    const badToken = parsed.error.issues.some((issue) => issue.path[0] === "token");
    if (badToken) throw new ActivationTokenRejectedError();
    throw new Error("Password must be 12 to 128 characters.");
  }
  await supplierAuthRepository.activateAccount(parsed.data);
}
