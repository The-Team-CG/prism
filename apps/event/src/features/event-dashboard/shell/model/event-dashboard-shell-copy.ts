import { portalUrlFor } from "@prism/types";
import { portalUrlsFromEnvironment } from "@/lib/portal-urls";

export function wrongEventPortalCopy(role: string, env: Record<string, string | undefined> = portalUrlsFromEnvironment()) {
  if (role === "client") return `Client accounts belong in the client portal at ${portalUrlFor("client", env)}.`;
  return `Supplier accounts belong in the supplier portal at ${portalUrlFor("supplier", env)}.`;
}

export function isUnsupportedEventPortalRole(role: string) {
  return role !== "pmcm-admin" && role !== "coordinator";
}
