declare const process: { env: Record<string, string | undefined> };

/** Apply the hosting prefix to native anchors; Next Link/router do this themselves. */
export function portalHref(href: string): string {
  const basePath = process.env.NEXT_PUBLIC_PORTAL_BASE_PATH ?? "";
  if (!basePath || !href.startsWith("/") || href.startsWith("//")) return href;
  if (href === basePath || href.startsWith(`${basePath}/`) || href.startsWith(`${basePath}?`) || href.startsWith(`${basePath}#`)) return href;
  return `${basePath}${href}`;
}
