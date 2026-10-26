import { PrismApiError } from "@prism/api-client";
import { activateAccountSchema, type ActivateAccountInput } from "@prism/types";
import { eventAuthRepository } from "../../sign-in/data/event-auth-repository";

/** "invalid-token" when the link is malformed or the API rejects it as expired or used. */
export async function activateEventAccount(input: ActivateAccountInput): Promise<"activated" | "invalid-token"> {
  const parsed = activateAccountSchema.safeParse(input);
  if (!parsed.success) {
    const badToken = parsed.error.issues.some((issue) => issue.path[0] === "token");
    if (badToken) return "invalid-token";
    throw new Error(parsed.error.issues[0].message);
  }
  try {
    await eventAuthRepository.activateAccount(parsed.data);
    return "activated";
  } catch (error) {
    if (error instanceof PrismApiError && error.status === 400) return "invalid-token";
    throw error;
  }
}
