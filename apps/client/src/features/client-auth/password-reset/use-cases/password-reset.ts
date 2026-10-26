import { consumePasswordResetSchema, requestPasswordResetSchema } from "@prism/types";
import { clientAuthRepository } from "../../sign-in/data/client-auth-repository";

export async function requestClientPasswordReset(email: string): Promise<string> {
  const parsed = requestPasswordResetSchema.safeParse({ email });
  if (!parsed.success) throw new Error("Enter a valid email address.");
  await clientAuthRepository.requestPasswordReset(parsed.data.email);
  return parsed.data.email;
}

export async function consumeClientPasswordReset(input: { token: string; password: string }): Promise<void> {
  const parsed = consumePasswordResetSchema.safeParse(input);
  if (!parsed.success) {
    const badToken = parsed.error.issues.some((issue) => issue.path[0] === "token");
    throw new Error(
      badToken ? "This reset link is not valid. Request a new one." : "Password must be 12 to 128 characters.",
    );
  }
  await clientAuthRepository.consumePasswordReset(parsed.data);
}
