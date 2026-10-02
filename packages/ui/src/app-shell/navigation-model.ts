import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  CalendarDays,
  CircleUserRound,
  ClipboardCheck,
  FileText,
  Home,
  MessageSquareText,
  Settings,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { PrismNavItem } from "./types";
export type PrismRailItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  targetId: string;
  badge?: string | number;
  active: boolean;
};

export function navSearchText(item: PrismNavItem) {
  const subItems = item.subItems?.map((subItem) => `${subItem.id} ${subItem.label}`).join(" ") ?? "";
  return `${item.id} ${item.label} ${item.section ?? ""} ${subItems}`.toLowerCase();
}

function findRailTarget(
  navItems: PrismNavItem[],
  matcher: (item: PrismNavItem, searchText: string) => boolean,
) {
  const enabled = navItems.find((item) => !item.disabled && matcher(item, navSearchText(item)));
  return enabled ?? navItems.find((item) => matcher(item, navSearchText(item)));
}

function matchesRailTarget(ids: readonly string[], pattern: RegExp) {
  return (item: PrismNavItem, text: string) => ids.includes(item.id) || pattern.test(text);
}

type RailSpec = {
  id: string;
  label: string;
  icon: LucideIcon;
  ids: readonly string[];
  pattern: RegExp;
  fallbackFirst?: boolean;
};

const PRIMARY_RAIL_SPECS: RailSpec[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Home,
    ids: ["command-home", "client-home", "dashboard", "home", "events"],
    pattern: /\bhome\b|\bdashboard\b/,
    fallbackFirst: true,
  },
  {
    id: "clients",
    label: "Clients",
    icon: CircleUserRound,
    ids: ["client-desk", "clients"],
    pattern: /\bclients?\b|\bonboarding\b|\bconforme\b/,
  },
  {
    id: "events",
    label: "Events",
    icon: CalendarDays,
    ids: ["command-events", "events"],
    pattern: /\bevents?\b|\bworkspaces?\b/,
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: CalendarClock,
    ids: ["calendar-desk", "calendar"],
    pattern: /\bcalendar\b|\bschedule\b/,
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: ClipboardCheck,
    ids: ["task-desk", "tasks"],
    pattern: /\btasks?\b|\bactions?\b|\bapprovals?\b|\binbox\b/,
  },
  {
    id: "files",
    label: "Files",
    icon: FileText,
    ids: ["file-hub"],
    pattern: /\bdocuments?\b|\bfiles?\b|\bfloor[- ]?plans?\b/,
  },
  {
    id: "team",
    label: "Team",
    icon: UsersRound,
    ids: ["team-desk", "employees"],
    pattern: /\bteam\b|\bemployees?\b|\bstaff\b|\bcoordinators?\b/,
  },
  {
    id: "messages",
    label: "Message",
    icon: MessageSquareText,
    ids: ["command-messages"],
    pattern: /message|messages|chat|conversation|feedback|activity/,
  },
  {
    id: "reports",
    label: "Reports",
    icon: ShieldCheck,
    ids: ["audit-log", "reports"],
    pattern: /\breports?\b|\baudit\b|\binsights?\b|\bprivacy\b|\bsecurity\b/,
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    ids: [],
    pattern: /setting|settings|profile|account/,
  },
];

function resolveRailCandidate(spec: RailSpec, navItems: PrismNavItem[]) {
  const matched = findRailTarget(navItems, matchesRailTarget(spec.ids, spec.pattern));
  const target = spec.fallbackFirst ? matched ?? navItems[0] : matched;
  if (!target) return null;
  return { id: spec.id, label: spec.label, icon: spec.icon, target };
}

function uniqueRailItems(
  candidates: Array<{ id: string; label: string; icon: LucideIcon; target: PrismNavItem }>,
  activeItemId: string,
) {
  const seenTargets = new Set<string>();
  const items: PrismRailItem[] = [];
  for (const item of candidates) {
    if (seenTargets.has(item.target.id)) continue;
    seenTargets.add(item.target.id);
    items.push({
      id: item.id,
      label: item.label,
      icon: item.icon,
      targetId: item.target.id,
      badge: item.target.badge,
      active: item.target.id === activeItemId,
    });
  }
  return { items, targetIds: seenTargets };
}

export function buildPrimaryRail(navItems: PrismNavItem[], activeItemId: string) {
  const candidates = PRIMARY_RAIL_SPECS.map((spec) => resolveRailCandidate(spec, navItems)).filter(
    (item): item is NonNullable<typeof item> => item !== null,
  );
  return uniqueRailItems(candidates, activeItemId);
}
