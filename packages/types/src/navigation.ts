const NAVIGATION_ORIGIN = "https://prism.invalid";

// Control characters (C0, DEL) are rejected before parsing: browsers strip some of them
// (tab, newline) from URLs, which would turn an accepted path into a cross-origin one.
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

/**
 * Returns a same-origin relative path (pathname + search + hash) from a user-supplied
 * `next` value, or `defaultPath` when the value is absent or could leave the site.
 */
export function safeNextPath(raw: string | null | undefined, defaultPath: string): string {
  if (typeof raw !== "string") return defaultPath;
  if (!raw.startsWith("/") || raw.startsWith("//")) return defaultPath;
  if (raw.includes("\\") || CONTROL_CHARACTER.test(raw)) return defaultPath;

  const resolved = new URL(raw, NAVIGATION_ORIGIN);
  if (resolved.origin !== NAVIGATION_ORIGIN) return defaultPath;
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

/** Where a signed-in person reads and acknowledges the privacy notice before continuing to `nextPath`. */
export function privacyNoticePath(nextPath: string): string {
  return `/privacy?next=${encodeURIComponent(nextPath)}`;
}
