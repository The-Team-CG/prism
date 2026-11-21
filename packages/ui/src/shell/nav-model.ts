import type * as React from "react";
import type { PrismMobileBar, PrismMobileTabAction, PrismNavItem } from "./types";

const DEFAULT_GROUP = "Workspace";

/** "MANAGEMENT" becomes "Management"; short acronyms such as "PMCM" stay as they are. */
function sentenceCase(label: string) {
  if (label !== label.toUpperCase() || label.length <= 4) return label;
  return label.charAt(0) + label.slice(1).toLowerCase();
}

export function groupNav(items: PrismNavItem[]) {
  const groups = new Map<string, PrismNavItem[]>();
  for (const item of items) {
    const key = sentenceCase(item.section ?? DEFAULT_GROUP);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return Array.from(groups, ([label, groupItems]) => ({ label, items: groupItems }));
}

export function isItemActive(item: PrismNavItem, activeId: string) {
  return item.id === activeId || Boolean(item.subItems?.some((sub) => sub.id === activeId));
}

export function findTrail(items: PrismNavItem[], activeId: string): string[] {
  for (const item of items) {
    if (item.id === activeId) return [item.label];
    const sub = item.subItems?.find((entry) => entry.id === activeId);
    if (sub) return [item.label, sub.label];
  }
  return [];
}

export function hasBadge(badge: PrismNavItem["badge"]) {
  return badge !== undefined && badge !== "";
}

/**
 * Destinations with an href are real links. A plain click keeps the portal's own (client-side) navigation;
 * modified or middle clicks fall through to the browser so "open in new tab" and copy-link work.
 */
export function navLinkClick(event: React.MouseEvent<HTMLAnchorElement>, select: () => void) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  select();
}

/** The phone bar with every tab and icon resolved to a sidebar item, and the sidebar items left over for More. */
export interface ResolvedMobileBar {
  tabs: PrismNavItem[];
  action?: PrismMobileTabAction;
  header: PrismNavItem[];
  more: PrismNavItem[];
}

/**
 * Turns a portal's phone bar into what the shell draws. A tab given by id takes that sidebar item; an unknown id is
 * dropped. A sidebar item lands in More unless a tab or top-bar icon already reaches it, itself or as a tab's sub-page.
 */
export function resolveMobileBar(bar: PrismMobileBar, navItems: PrismNavItem[]): ResolvedMobileBar {
  const byId = new Map(navItems.map((item) => [item.id, item]));
  const pick = (entry: string | PrismNavItem) => (typeof entry === "string" ? byId.get(entry) : entry);
  const tabs = bar.tabs.map(pick).filter((item): item is PrismNavItem => Boolean(item));
  const header = (bar.header ?? []).map(pick).filter((item): item is PrismNavItem => Boolean(item));
  const reached = new Set([...tabs, ...header].flatMap((item) => [item.id, ...(item.subItems ?? []).map((sub) => sub.id)]));
  const more = navItems.filter((item) => !reached.has(item.id));
  return { tabs, action: bar.action, header, more };
}

/** More lights up on its own pages and carries a dot when anything inside it has a badge. */
export function moreState(more: PrismNavItem[], activeId: string) {
  return {
    active: more.some((item) => isItemActive(item, activeId)),
    hasNews: more.some((item) => hasBadge(item.badge) || Boolean(item.subItems?.some((sub) => hasBadge(sub.badge)))),
  };
}
