import { consumePasswordResetSchema, requestPasswordResetSchema } from "@prism/types";
import { eventAuthRepository } from "../../sign-in/data/event-auth-repository";

export async function requestEventPasswordReset(email: string): Promise<string> {
  const parsed = requestPasswordResetSchema.safeParse({ email });
  if (!parsed.success) throw new Error("Enter a valid email address.");
  await eventAuthRepository.requestPasswordReset(parsed.data.email);
  return parsed.data.email;
}

export async function consumeEventPasswordReset(input: { token: string; password: string }): Promise<void> {
  const parsed = consumePasswordResetSchema.safeParse(input);
  if (!parsed.success) {
    const badToken = parsed.error.issues.some((issue) => issue.path[0] === "token");
    throw new Error(
      badToken ? "This reset link is not valid. Request a new one." : "Password must be 12 to 128 characters.",
    );
  }
  await eventAuthRepository.consumePasswordReset(parsed.data);
}
