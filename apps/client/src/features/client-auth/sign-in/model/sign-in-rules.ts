import { portalUrlFor, safeNextPath } from "@prism/types";
import { portalUrlsFromEnvironment } from "@/lib/portal-urls";
import type { SignInDraft } from "./sign-in-types";

export function isSignInDraftValid(draft: SignInDraft): boolean {
  return draft.email.trim().length > 0 && draft.password.length > 0;
}

export function isClientRole(role: string): boolean {
  return role === "client";
}

export function portalMessage(role: string, env: Record<string, string | undefined> = portalUrlsFromEnvironment()): string {
  if (role === "pmcm-admin" || role === "coordinator") {
    return `Event team accounts sign in through the event operations portal at ${portalUrlFor("event", env)}.`;
  }
  if (role === "supplier") {
    return `Supplier accounts sign in through the supplier portal at ${portalUrlFor("supplier", env)}.`;
  }
  return "This portal only accepts approved client accounts.";
}

export function resolvePostSignInPath(nextParam: string | null | undefined): string {
  return safeNextPath(nextParam, "/dashboard");
}

export function mapSignInFailure(input: {
  message: string;
}): string {
  const { message } = input;
  return message.includes("Invalid")
    ? "Use the approved client account issued by PMCM for this portal."
    : message;
}

export function mapSignInError(error: unknown, fallback = "Sign in failed"): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
