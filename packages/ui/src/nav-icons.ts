import {
  Bell,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  FileText,
  Home,
  Inbox,
  LayoutGrid,
  ListOrdered,
  ListTodo,
  MessageSquareText,
  PartyPopper,
  Radio,
  ReceiptText,
  Truck,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { ResolvedMobileBar } from "./shell/nav-model";
import type { PrismNavItem } from "./shell/types";

/**
 * One icon per idea, in every portal's sidebar and phone bar, keyed by the name people see. A portal names its items
 * from here, so Calendar is the same calendar for a client, a supplier, PMCM and a coordinator.
 */
export const PRISM_NAV_ICONS = {
  Home,
  Inbox,
  Overview: LayoutGrid,
  Events: PartyPopper,
  "All events": PartyPopper,
  Calendar: CalendarDays,
  "Run sheet": ListOrdered,
  Planning: ClipboardList,
  Briefing: FileCheck2,
  Tasks: ListTodo,
  Requests: ReceiptText,
  Billing: WalletCards,
  Messages: MessageSquareText,
  Notifications: Bell,
  Files: FileText,
  Suppliers: Truck,
  Live: Radio,
} as const satisfies Record<string, LucideIcon>;

type NavIconItem = Pick<PrismNavItem, "label" | "shortLabel" | "icon">;

function sharedIcon(item: NavIconItem): [string, LucideIcon] | undefined {
  for (const name of [item.shortLabel, item.label]) {
    if (name && name in PRISM_NAV_ICONS) return [name, PRISM_NAV_ICONS[name as keyof typeof PRISM_NAV_ICONS]];
  }
  return undefined;
}

/** Items named like a shared idea but drawn with another icon, as their names. Empty when the portal follows the set. */
export function navIconDrift(items: readonly NavIconItem[]): string[] {
  return items.flatMap((item) => {
    const shared = sharedIcon(item);
    return shared && shared[1] !== item.icon ? [shared[0]] : [];
  });
}

/** Names in one phone bar (its tabs and top-bar icons) that share an icon with another, so they look like the same page. */
export function phoneBarIconClashes(bar: Pick<ResolvedMobileBar, "tabs" | "header">): string[] {
  const items = [...bar.tabs, ...bar.header];
  return items.filter((item) => items.some((other) => other !== item && other.icon === item.icon)).map((item) => item.shortLabel ?? item.label);
}
