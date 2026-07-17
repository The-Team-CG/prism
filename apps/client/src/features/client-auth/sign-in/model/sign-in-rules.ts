import type { PrismUser } from "@prism/types";
import type { SignInDraft } from "./sign-in-types";
import { CLIENT_SAMPLE_USERS, SAMPLE_PASSWORDS } from "./sign-in-types";

export function isSignInDraftValid(draft: SignInDraft): boolean {
  return draft.email.trim().length > 0 && draft.password.length > 0;
}

export function isClientRole(role: string): boolean {
  return role === "client";
}

export function portalMessage(role: string): string {
  if (role === "pmcm-admin" || role === "coordinator") {
    return "Event team accounts sign in through the event operations portal at http://localhost:3004.";
  }
  if (role === "supplier") {
    return "Supplier accounts sign in through the supplier portal at http://localhost:3002.";
  }
  return "This portal only accepts approved client accounts.";
}

export function resolvePostSignInPath(nextParam: string | null | undefined): string {
  if (nextParam && nextParam.startsWith("/")) return nextParam;
  return "/dashboard";
}

export function findClientSampleUser(email: string): PrismUser | undefined {
  return CLIENT_SAMPLE_USERS.find((user) => user.email.toLowerCase() === email.trim().toLowerCase());
}

export function samplePasswordFor(email: string): string {
  return SAMPLE_PASSWORDS[email] ?? "prism-client";
}

export function mapSignInFailure(input: {
  message: string;
  sampleUser?: PrismUser;
}): { error: string; pendingUser: PrismUser | null } {
  const { message, sampleUser } = input;
  if (sampleUser && sampleUser.role !== "client") {
    return { error: portalMessage(sampleUser.role), pendingUser: null };
  }
  if (sampleUser && sampleUser.approvalStatus !== "approved") {
    return {
      error: "This client account is waiting for approval.",
      pendingUser: sampleUser,
    };
  }
  return {
    error: message.includes("Invalid")
      ? "Use the approved client account issued by PMCM for this portal."
      : message,
    pendingUser: null,
  };
}

export function mapSignInError(error: unknown, fallback = "Sign in failed"): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
