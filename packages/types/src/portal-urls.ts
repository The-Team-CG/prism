export type PrismPortalApp = "client" | "supplier" | "guest" | "event";

const DEFAULT_PORTAL_URLS: Record<PrismPortalApp, string> = {
  client: "http://localhost:3001",
  supplier: "http://localhost:3002",
  guest: "http://localhost:3003",
  event: "http://localhost:3004",
};

export function portalUrlFor(
  app: PrismPortalApp,
  env: Record<string, string | undefined> = {},
): string {
  return env[`NEXT_PUBLIC_${app.toUpperCase()}_PORTAL_URL`] ?? DEFAULT_PORTAL_URLS[app];
}
