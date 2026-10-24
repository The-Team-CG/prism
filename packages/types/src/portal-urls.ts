export type PrismPortalApp = "client" | "supplier" | "guest" | "event";

/**
 * Returns a portal's browser origin from the NEXT_PUBLIC_<APP>_PORTAL_URL value in `env`.
 * There is no default: a missing or blank value throws and names the variable. Callers pass
 * literal reads (see each portal's `lib/portal-urls.ts`), because a bare `process.env` is empty
 * in the browser.
 */
export function portalUrlFor(
  app: PrismPortalApp,
  env: Record<string, string | undefined>,
): string {
  const name = `NEXT_PUBLIC_${app.toUpperCase()}_PORTAL_URL`;
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
