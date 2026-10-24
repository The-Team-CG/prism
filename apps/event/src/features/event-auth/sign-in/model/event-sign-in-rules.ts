import { portalUrlFor } from "@prism/types";
import { portalUrlsFromEnvironment } from "@/lib/portal-urls";

export type EventPortalRole = "pmcm-admin" | "coordinator" | "client" | "supplier" | string;

export function isEventPortalRole(role: EventPortalRole): boolean {
  return role === "pmcm-admin" || role === "coordinator";
}

export function eventRoleRejectionMessage(role: EventPortalRole, env: Record<string, string | undefined> = portalUrlsFromEnvironment()): string {
  if (role === "client") {
    return `Client accounts sign in through the client portal at ${portalUrlFor("client", env)}.`;
  }
  if (role === "supplier") {
    return `Supplier accounts sign in through the supplier portal at ${portalUrlFor("supplier", env)}.`;
  }
  return "Only PMCM admin and coordinator accounts can use the event portal.";
}

export function resolveEventPostSignInPath(nextParam: string | null | undefined): string {
  if (nextParam && nextParam.startsWith("/")) return nextParam;
  return "/dashboard";
}

export function isSignInDraftValid(email: string, password: string): boolean {
  return email.trim().length > 0 && password.length > 0;
}

export function mapSignInError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Sign in failed";
}
