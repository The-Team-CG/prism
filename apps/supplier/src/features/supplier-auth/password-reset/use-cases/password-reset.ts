import { consumePasswordResetSchema, requestPasswordResetSchema } from "@prism/types";
import { supplierAuthRepository } from "../../sign-in/data/supplier-auth-repository";

export async function requestSupplierPasswordReset(email: string): Promise<string> {
  const parsed = requestPasswordResetSchema.safeParse({ email });
  if (!parsed.success) throw new Error("Enter a valid email address.");
  await supplierAuthRepository.requestPasswordReset({ email: parsed.data.email });
  return parsed.data.email;
}

export async function consumeSupplierPasswordReset(input: { token: string; password: string }): Promise<void> {
  const parsed = consumePasswordResetSchema.safeParse(input);
  if (!parsed.success) {
    const badToken = parsed.error.issues.some((issue) => issue.path[0] === "token");
    throw new Error(
      badToken ? "This reset link is not valid. Request a new one." : "Password must be 12 to 128 characters.",
    );
  }
  await supplierAuthRepository.consumePasswordReset(parsed.data);
}
