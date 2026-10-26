declare const process: { env: Record<string, string | undefined> };

/** Apply the hosting prefix to native anchors; Next Link/router do this themselves. */
export function portalHref(href: string): string {
  const basePath = process.env.NEXT_PUBLIC_PORTAL_BASE_PATH ?? "";
  if (!basePath || !href.startsWith("/") || href.startsWith("//")) return href;
  if (href === basePath || href.startsWith(`${basePath}/`) || href.startsWith(`${basePath}?`) || href.startsWith(`${basePath}#`)) return href;
  return `${basePath}${href}`;
}

/** Inverse of portalHref for a browser pathname: the app-relative path that Next routing expects. */
export function portalAppPath(pathname: string): string {
  const basePath = process.env.NEXT_PUBLIC_PORTAL_BASE_PATH ?? "";
  if (!basePath || !pathname.startsWith(basePath)) return pathname;
  const rest = pathname.slice(basePath.length);
  if (rest === "") return "/";
  return rest.startsWith("/") ? rest : pathname;
}
