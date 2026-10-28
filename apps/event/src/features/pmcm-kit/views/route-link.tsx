import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { portalHref } from "@prism/ui/portal-path";

/**
 * A route change rendered as a real link, so it opens in a new tab and its address can be copied.
 * A plain left click keeps the dashboard's client-side navigation through `onNavigate`.
 */
export function RouteLink({ href, onNavigate, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; onNavigate: () => void }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate();
  }
  return <a href={portalHref(href)} onClick={handleClick} {...props} />;
}
