"use client";

import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CalendarClock,
  CalendarDays,
  CircleUserRound,
  ClipboardCheck,
  FileText,
  Home,
  LogOut,
  MessageSquareText,
  PanelLeft,
  Search,
  Settings,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import * as React from "react";
import { PrismBrandLogo } from "./brand";
import { PrismBadge, PrismButton } from "./primitives";
import { cn } from "./utils";

export interface PrismNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  section?: string;
  groupId?: string;
  badge?: string | number;
  disabled?: boolean;
  subItems?: PrismNavSubItem[];
}

export interface PrismNavSubItem {
  id: string;
  label: string;
  badge?: string | number;
  disabled?: boolean;
}

export interface PrismPrimaryNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  targetId?: string;
  badge?: string | number;
  disabled?: boolean;
}

export interface PrismUserSummary {
  name: string;
  detail?: string;
  initials?: string;
}

export interface PrismPageAction {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  status?: string;
  onSelect?: () => void;
}

export interface PrismMobileAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect?: () => void;
  active?: boolean;
  disabled?: boolean;
}

export interface PrismAccountMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onSelect?: () => void;
  tone?: "default" | "danger";
  separatorBefore?: boolean;
}

export interface PrismAppShellProps {
  productLabel?: string;
  roleLabel: string;
  eyebrow: string;
  title: string;
  description?: string;
  activeItemId: string;
  navItems: PrismNavItem[];
  onNavSelect?: (id: string) => void;
  primaryNavItems?: PrismPrimaryNavItem[];
  activePrimaryItemId?: string;
  nestedSidebarTitle?: string;
  nestedSidebarDetail?: string;
  user?: PrismUserSummary;
  searchPlaceholder?: string;
  commandActions?: PrismPageAction[];
  commandSectionLabel?: string;
  headerActions?: React.ReactNode;
  accountMenuItems?: PrismAccountMenuItem[];
  rightRail?: React.ReactNode;
  mobileActions?: PrismMobileAction[];
  sidebarMode?: "auto" | "single";
  onSignOut?: () => void;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  homeHref?: string;
}

function initialsFor(name?: string) {
  if (!name) return "PM";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "PM"
  );
}

function PrismUserAvatar({ user, className }: { user: PrismUserSummary; className?: string }) {
  return (
    <span
      className={cn(
        "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-secondary text-xs font-black text-foreground",
        className,
      )}
      aria-hidden="true"
    >
      {user.initials ?? initialsFor(user.name)}
      <span className="absolute bottom-0.5 right-0.5 size-2.5 rounded-full border-2 border-card bg-(--prism-success)" />
    </span>
  );
}

type PrismRailItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  targetId: string;
  badge?: string | number;
  active: boolean;
};

function navSearchText(item: PrismNavItem) {
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

function buildPrimaryRail(navItems: PrismNavItem[], activeItemId: string) {
  const dashboardTarget =
    findRailTarget(
      navItems,
      (item, text) =>
        item.id === "command-home" ||
        item.id === "client-home" ||
        item.id === "dashboard" ||
        item.id === "home" ||
        item.id === "events" ||
        /\bhome\b|\bdashboard\b/.test(text),
    ) ?? navItems[0];
  const clientsTarget = findRailTarget(navItems, (item, text) =>
    item.id === "client-desk" || item.id === "clients" || /\bclients?\b|\bonboarding\b|\bconforme\b/.test(text),
  );
  const eventsTarget = findRailTarget(navItems, (item, text) =>
    item.id === "command-events" || item.id === "events" || /\bevents?\b|\bworkspaces?\b/.test(text),
  );
  const calendarTarget = findRailTarget(navItems, (item, text) =>
    item.id === "calendar-desk" || item.id === "calendar" || /\bcalendar\b|\bschedule\b/.test(text),
  );
  const tasksTarget = findRailTarget(navItems, (item, text) =>
    item.id === "task-desk" || item.id === "tasks" || /\btasks?\b|\bactions?\b|\bapprovals?\b|\binbox\b/.test(text),
  );
  const filesTarget = findRailTarget(navItems, (item, text) =>
    item.id === "file-hub" || /\bdocuments?\b|\bfiles?\b|\bfloor[- ]?plans?\b/.test(text),
  );
  const teamTarget = findRailTarget(navItems, (item, text) =>
    item.id === "team-desk" || item.id === "employees" || /\bteam\b|\bemployees?\b|\bstaff\b|\bcoordinators?\b/.test(text),
  );
  const messagesTarget = findRailTarget(navItems, (item, text) =>
    item.id === "command-messages" || /message|messages|chat|conversation|feedback|activity/.test(text),
  );
  const reportsTarget = findRailTarget(navItems, (item, text) =>
    item.id === "audit-log" || item.id === "reports" || /\breports?\b|\baudit\b|\binsights?\b|\bprivacy\b|\bsecurity\b/.test(text),
  );
  const settingsTarget = findRailTarget(navItems, (_item, text) => /setting|settings|profile|account/.test(text));

  const candidates = [
    dashboardTarget
      ? { id: "dashboard", label: "Dashboard", icon: Home, target: dashboardTarget }
      : null,
    clientsTarget
      ? { id: "clients", label: "Clients", icon: CircleUserRound, target: clientsTarget }
      : null,
    eventsTarget
      ? { id: "events", label: "Events", icon: CalendarDays, target: eventsTarget }
      : null,
    calendarTarget
      ? { id: "calendar", label: "Calendar", icon: CalendarClock, target: calendarTarget }
      : null,
    tasksTarget
      ? { id: "tasks", label: "Tasks", icon: ClipboardCheck, target: tasksTarget }
      : null,
    filesTarget
      ? { id: "files", label: "Files", icon: FileText, target: filesTarget }
      : null,
    teamTarget
      ? { id: "team", label: "Team", icon: UsersRound, target: teamTarget }
      : null,
    messagesTarget
      ? { id: "messages", label: "Message", icon: MessageSquareText, target: messagesTarget }
      : null,
    reportsTarget
      ? { id: "reports", label: "Reports", icon: ShieldCheck, target: reportsTarget }
      : null,
    settingsTarget
      ? { id: "settings", label: "Settings", icon: Settings, target: settingsTarget, bottom: true }
      : null,
  ].filter(Boolean) as Array<{
    id: string;
    label: string;
    icon: LucideIcon;
    target: PrismNavItem;
    bottom?: boolean;
  }>;

  const seenTargets = new Set<string>();
  const items = candidates.reduce<PrismRailItem[]>((resolved, item) => {
    if (seenTargets.has(item.target.id)) return resolved;
    seenTargets.add(item.target.id);
    resolved.push({
      id: item.id,
      label: item.label,
      icon: item.icon,
      targetId: item.target.id,
      badge: item.target.badge,
      active: item.target.id === activeItemId,
    });
    return resolved;
  }, []);

  return {
    items,
    targetIds: seenTargets,
  };
}

function PrismAccountMenu({
  user,
  items = [],
  onSignOut,
}: {
  user: PrismUserSummary;
  items?: PrismAccountMenuItem[];
  onSignOut?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const resolvedItems = React.useMemo<PrismAccountMenuItem[]>(() => {
    const baseItems = items.length
      ? items
      : [
          { id: "profile", label: "My Profile", icon: CircleUserRound },
          { id: "workspace", label: "My Workspace", icon: CalendarDays },
          { id: "documents", label: "My Documents", icon: FileText },
          { id: "settings", label: "Account Settings", icon: Settings, separatorBefore: true },
        ];

    return onSignOut
      ? [
          ...baseItems,
          {
            id: "signout",
            label: "Signout",
            icon: LogOut,
            tone: "danger",
            separatorBefore: true,
            onSelect: onSignOut,
          },
        ]
      : baseItems;
  }, [items, onSignOut]);

  React.useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        className="grid size-9 place-items-center rounded-full outline-none ring-offset-card transition hover:ring-2 hover:ring-primary/18 focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <PrismUserAvatar user={user} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-[0_20px_60px_rgba(23,18,22,0.16)]"
        >
          <div className="flex items-center gap-3 px-4 py-4">
            <PrismUserAvatar user={user} className="size-11" />
            <div className="min-w-0">
              <p className="truncate text-sm font-black leading-5 text-foreground">{user.name}</p>
              {user.detail ? (
                <p className="truncate text-sm leading-5 text-muted-foreground">{user.detail}</p>
              ) : null}
            </div>
          </div>

          <div className="border-t border-border py-1">
            {resolvedItems.map((item) => {
              const Icon = item.icon;
              const content = (
                <>
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </>
              );
              const className = cn(
                "flex h-11 w-full items-center gap-3 px-4 text-left text-sm font-bold transition hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none",
                item.tone === "danger" ? "text-destructive hover:text-destructive" : "text-foreground",
              );

              return (
                <React.Fragment key={item.id}>
                  {item.separatorBefore ? <div className="my-1 border-t border-border" /> : null}
                  {item.href ? (
                    <a href={item.href} role="menuitem" className={className} onClick={() => setOpen(false)}>
                      {content}
                    </a>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      className={className}
                      onClick={() => {
                        setOpen(false);
                        item.onSelect?.();
                      }}
                    >
                      {content}
                    </button>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PrismSidebar({
  productLabel = "P.R.I.S.M",
  roleLabel,
  activeItemId,
  navItems,
  onNavSelect,
  commandActions = [],
  commandSectionLabel = "Workflows",
  homeHref = "/",
  collapsed = false,
  hiddenItemIds,
  visibleGroupId,
  showBrand = true,
  panelTitle,
  panelDetail,
}: Pick<
  PrismAppShellProps,
  | "productLabel"
  | "roleLabel"
  | "activeItemId"
  | "navItems"
  | "onNavSelect"
  | "commandActions"
  | "commandSectionLabel"
  | "homeHref"
> & {
  collapsed?: boolean;
  hiddenItemIds?: ReadonlySet<string>;
  visibleGroupId?: string;
  showBrand?: boolean;
  panelTitle?: string;
  panelDetail?: string;
}) {
  const groupFilteredNavItems = visibleGroupId ? navItems.filter((item) => item.groupId === visibleGroupId) : navItems;
  const visibleNavItems = hiddenItemIds?.size
    ? groupFilteredNavItems.filter((item) => !hiddenItemIds.has(item.id))
    : groupFilteredNavItems;
  const navGroups = visibleNavItems.reduce<Array<{ section: string; items: PrismNavItem[] }>>((groups, item) => {
    const section = item.section ?? "Dashboards";
    const existing = groups.find((group) => group.section === section);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({ section, items: [item] });
    }
    return groups;
  }, []);

  return (
    <div className="flex h-full w-full min-w-0 flex-col bg-card text-foreground">
      {showBrand ? (
        <PrismBrandLogo
          href={homeHref}
          title={productLabel.endsWith(".") ? productLabel : `${productLabel}.`}
          detail={roleLabel}
          compact={collapsed}
          className={cn("min-h-16 px-3", collapsed && "justify-center px-2")}
          markClassName="size-8 bg-transparent ring-0"
        />
      ) : (
        <div className="min-h-16 border-b border-border px-4 py-4">
          <p className="truncate text-sm font-black text-foreground">{panelTitle ?? roleLabel}</p>
          {panelDetail ? <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{panelDetail}</p> : null}
        </div>
      )}

      {!collapsed && showBrand ? (
        <div className="px-3 pb-3">
          <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-background/80 px-2.5 text-xs font-semibold text-muted-foreground shadow-sm">
            <Search aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Command</span>
            <span className="text-[11px] font-black text-muted-foreground/70">/</span>
          </div>
        </div>
      ) : null}

      <nav className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-3 pb-4 pt-1">
        {navGroups.map((group, groupIndex) => (
          <div key={group.section} className={cn("flex flex-col gap-1.5", groupIndex > 0 && "mt-6")}>
            <p className={cn("px-2 pb-1 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground", collapsed && "sr-only")}>
              {group.section}
            </p>
            {group.items.map((item) => {
              const subItemActive = item.subItems?.some((subItem) => subItem.id === activeItemId) ?? false;
              const itemActive = item.id === activeItemId || subItemActive;

              return (
                <div key={item.id} className="min-w-0">
                  <button
                    type="button"
                    disabled={item.disabled}
                    aria-current={item.id === activeItemId ? "page" : undefined}
                    data-active={itemActive}
                    onClick={() => onNavSelect?.(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex h-9 w-full items-center gap-2 overflow-hidden rounded-md px-2 text-left text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:bg-secondary focus-visible:text-foreground active:bg-secondary disabled:cursor-not-allowed disabled:opacity-45 data-[active=true]:bg-primary/10 data-[active=true]:font-bold data-[active=true]:text-primary",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <item.icon aria-hidden="true" className="size-3.5 shrink-0" />
                    <span className={cn("min-w-0 flex-1 truncate", collapsed && "sr-only")}>{item.label}</span>
                    {item.badge && !collapsed ? (
                      <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-black leading-none text-muted-foreground ring-1 ring-border">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>

                  {item.subItems?.length && !collapsed ? (
                    <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-border/80 pl-2">
                      {item.subItems.map((subItem) => (
                        <button
                          key={subItem.id}
                          type="button"
                          disabled={item.disabled || subItem.disabled}
                          aria-current={subItem.id === activeItemId ? "page" : undefined}
                          data-active={subItem.id === activeItemId}
                          onClick={() => onNavSelect?.(subItem.id)}
                          className="flex min-h-7 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:bg-secondary focus-visible:text-foreground disabled:cursor-not-allowed disabled:opacity-45 data-[active=true]:bg-primary/10 data-[active=true]:font-bold data-[active=true]:text-primary"
                        >
                          <span className="size-1.5 shrink-0 rounded-full bg-current opacity-40" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">{subItem.label}</span>
                          {subItem.badge ? (
                            <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-black leading-none text-muted-foreground ring-1 ring-border">
                              {subItem.badge}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}

        {commandActions.length && !collapsed ? (
          <div className="mt-6 flex flex-col gap-1.5">
            <p className="px-1.5 pb-1 text-[11px] font-black uppercase text-primary">
              {commandSectionLabel}
            </p>
            {commandActions.slice(0, 5).map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={action.onSelect}
                className="group flex min-h-8 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:bg-secondary focus-visible:text-foreground active:bg-secondary"
              >
                {action.icon ? <action.icon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{action.label}</span>
                  {action.description ? (
                    <span className="block truncate text-[11px] font-medium text-muted-foreground">
                      {action.description}
                    </span>
                  ) : null}
                </span>
                {action.status ? (
                  <span className="max-w-12 truncate rounded-full bg-background px-1.5 py-0.5 text-[10px] font-black leading-none text-foreground ring-1 ring-border">
                    {action.status}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </nav>
    </div>
  );
}

function PrismIconRail({
  productLabel = "P.R.I.S.M",
  activeItemId,
  navItems,
  onNavSelect,
  homeHref = "/",
  user,
  railItems,
}: Pick<
  PrismAppShellProps,
  "productLabel" | "activeItemId" | "navItems" | "onNavSelect" | "homeHref" | "user"
> & {
  railItems?: PrismRailItem[];
}) {
  const resolvedRailItems = railItems ?? buildPrimaryRail(navItems, activeItemId).items;
  const settingsItem = resolvedRailItems.find((item) => item.id === "settings");
  const topItems = resolvedRailItems.filter((item) => item.id !== "settings");

  return (
    <div className="flex h-full w-[3.75rem] shrink-0 flex-col items-center border-r border-border bg-background px-2 py-3 text-foreground">
      <PrismBrandLogo
        href={homeHref}
        title={productLabel.endsWith(".") ? productLabel : `${productLabel}.`}
        compact
        className="grid size-10 place-items-center justify-center"
        markClassName="size-8 rounded-lg bg-transparent ring-0"
      />

      <nav className="mt-5 flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto" aria-label="Primary navigation">
        {topItems.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={item.active ? "page" : undefined}
            data-active={item.active}
            title={item.label}
            onClick={() => onNavSelect?.(item.targetId)}
            className="relative grid size-9 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:bg-secondary focus-visible:text-foreground focus-visible:outline-none active:bg-secondary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
          >
            <item.icon aria-hidden="true" className="size-4" />
            {item.badge ? (
              <span className="absolute right-1 top-1 size-1.5 rounded-full bg-(--prism-amber) ring-2 ring-background" aria-hidden="true" />
            ) : null}
            <span className="sr-only">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-3 flex w-full flex-col items-center gap-1 border-t border-border pt-3">
        {settingsItem ? (
          <button
            type="button"
            data-active={settingsItem.active}
            className="grid size-9 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:bg-secondary focus-visible:text-foreground focus-visible:outline-none data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
            title={settingsItem.label}
            aria-label={settingsItem.label}
            aria-current={settingsItem.active ? "page" : undefined}
            onClick={() => onNavSelect?.(settingsItem.targetId)}
          >
            <Settings aria-hidden="true" className="size-4" />
          </button>
        ) : null}
        {user ? (
          <span title={user.name} className="grid size-9 place-items-center rounded-full border border-border bg-card text-[11px] font-black text-foreground">
            {user.initials ?? initialsFor(user.name)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function PrismMainSidebar({
  productLabel = "P.R.I.S.M",
  roleLabel,
  items,
  activeItemId,
  onNavSelect,
  homeHref = "/",
}: {
  productLabel?: string;
  roleLabel: string;
  items: PrismPrimaryNavItem[];
  activeItemId?: string;
  onNavSelect?: (id: string) => void;
  homeHref?: string;
}) {
  return (
    <div className="flex h-full w-[3.75rem] shrink-0 flex-col items-center border-r border-border bg-background px-2 py-3 text-foreground">
      <PrismBrandLogo
        href={homeHref}
        title={productLabel.endsWith(".") ? productLabel : `${productLabel}.`}
        detail={roleLabel}
        compact
        className="min-h-10 justify-center"
        markClassName="size-8 rounded-lg bg-transparent ring-0"
      />

      <nav className="mt-5 flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto" aria-label="Main sidebar">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            data-active={item.id === activeItemId}
            aria-current={item.id === activeItemId ? "page" : undefined}
            aria-label={item.label}
            title={item.label}
            onClick={() => onNavSelect?.(item.targetId ?? item.id)}
            className="group relative grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:bg-secondary focus-visible:text-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
          >
            <item.icon aria-hidden="true" className="size-4 shrink-0" />
            {item.badge ? (
              <span className="absolute right-1 top-1 grid min-w-3 place-items-center rounded-full bg-primary px-1 text-[8px] font-black leading-3 text-primary-foreground ring-2 ring-background">
                {Number(item.badge) > 9 ? "9+" : item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>
    </div>
  );
}

export function PrismTopBar({
  eyebrow,
  title,
  description,
  searchPlaceholder,
  headerActions,
  accountMenuItems,
  user,
  onSignOut,
  onOpenMobileNav,
  onToggleDesktopNav,
  sidebarCollapsed,
}: Pick<
  PrismAppShellProps,
  "eyebrow" | "title" | "description" | "searchPlaceholder" | "headerActions" | "accountMenuItems" | "user" | "onSignOut"
> & {
  onOpenMobileNav?: () => void;
  onToggleDesktopNav?: () => void;
  sidebarCollapsed?: boolean;
}) {
  const placeholder = searchPlaceholder ?? "Search";

  return (
    <header
      className="sticky top-3 z-40 mx-3 mb-4 mt-3 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm sm:top-4 sm:mx-4 sm:mt-4 sm:mb-5 sm:px-4 md:top-5 md:mx-5 md:mt-5"
      aria-label={`${eyebrow}: ${title}`}
    >
      <div className="flex items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {onOpenMobileNav ? (
            <PrismButton
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground md:hidden"
              onClick={onOpenMobileNav}
              aria-label="Open navigation"
            >
              <PanelLeft aria-hidden="true" />
            </PrismButton>
          ) : null}
          {onToggleDesktopNav ? (
            <PrismButton
              variant="ghost"
              size="icon"
              className="hidden size-8 text-muted-foreground md:inline-flex"
              onClick={onToggleDesktopNav}
              aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
            >
              <PanelLeft aria-hidden="true" />
            </PrismButton>
          ) : null}
          <span className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-md border-0 bg-transparent pl-8 pr-3 text-sm font-medium outline-none placeholder:text-muted-foreground focus-visible:ring-0"
              placeholder={placeholder}
            />
            <span className="sr-only">
              {description ? `${title}. ${description}` : title}
            </span>
          </label>
        </div>
        {headerActions ? <div className="hidden shrink-0 items-center gap-2 md:flex">{headerActions}</div> : null}
        <button
          type="button"
          className="relative grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell aria-hidden="true" className="size-3.5" />
          <span className="absolute right-1 top-1 size-1.5 rounded-full bg-(--prism-amber) ring-2 ring-card" aria-hidden="true" />
        </button>
        {user ? (
          <PrismAccountMenu user={user} items={accountMenuItems} onSignOut={onSignOut} />
        ) : null}
      </div>
    </header>
  );
}

export function MobileActionDock({ actions }: { actions: PrismMobileAction[] }) {
  if (!actions.length) return null;
  const visibleActions = actions.slice(0, 4);
  return (
    <div className="mx-4 mt-4 rounded-lg border border-border bg-card p-1.5 shadow-sm sm:mx-5 md:hidden">
      <div className={cn("grid gap-1", visibleActions.length === 4 ? "grid-cols-4" : "grid-cols-3")}>
        {visibleActions.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={action.disabled}
            data-active={action.active}
            onClick={action.onSelect}
            className="flex h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-bold text-muted-foreground transition hover:bg-primary hover:text-primary-foreground focus-visible:bg-primary focus-visible:text-primary-foreground active:bg-primary active:text-primary-foreground disabled:opacity-45 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
          >
            <action.icon aria-hidden="true" className="size-5" />
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function RolePageHeader({
  eyebrow,
  title,
  description,
  meta,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: Array<string | React.ReactNode>;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-md border border-border bg-card px-4 py-3 shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-black uppercase text-muted-foreground">{eyebrow}</p>
          ) : null}
          <h2 className="mt-0.5 text-lg font-black leading-tight text-foreground sm:text-xl">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">{description}</p>
          ) : null}
          {meta?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {meta.map((item, index) =>
                typeof item === "string" ? (
                  <PrismBadge key={`${item}-${index}`} variant="outline">
                    {item}
                  </PrismBadge>
                ) : (
                  <React.Fragment key={index}>{item}</React.Fragment>
                ),
              )}
            </div>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}

export function PrismAppShell({
  productLabel,
  roleLabel,
  eyebrow,
  title,
  description,
  activeItemId,
  navItems,
  onNavSelect,
  primaryNavItems,
  activePrimaryItemId,
  nestedSidebarTitle,
  nestedSidebarDetail,
  user,
  searchPlaceholder,
  commandActions,
  commandSectionLabel,
  headerActions,
  accountMenuItems,
  rightRail,
  mobileActions = [],
  sidebarMode = "auto",
  children,
  className,
  contentClassName,
  homeHref,
  onSignOut,
}: PrismAppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [desktopOpen, setDesktopOpen] = React.useState(true);
  const useSingleSidebar = sidebarMode === "single";
  const hasStructuredPrimaryNav = !useSingleSidebar && Boolean(primaryNavItems?.length);
  const primaryRail = React.useMemo(() => buildPrimaryRail(navItems, activeItemId), [navItems, activeItemId]);
  const desktopHiddenItemIds = React.useMemo(
    () =>
      !hasStructuredPrimaryNav && navItems.length > 6
        ? new Set(
            Array.from(primaryRail.targetIds).filter(
              (id) =>
                id.startsWith("command-") ||
                id.endsWith("-desk") ||
                id === "supplier-directory" ||
                id === "file-hub" ||
                id === "audit-log" ||
                id === "settings",
            ),
          )
        : new Set<string>(),
    [hasStructuredPrimaryNav, navItems.length, primaryRail.targetIds],
  );

  const handleNavSelect = React.useCallback((id: string) => {
    onNavSelect?.(id);
    setMobileOpen(false);
  }, [onNavSelect]);

  const renderSidebar = (collapsed = false, hidePrimaryRailItems = false) => (
    <PrismSidebar
      productLabel={productLabel}
      roleLabel={roleLabel}
      activeItemId={activeItemId}
      navItems={navItems}
      onNavSelect={handleNavSelect}
      commandActions={commandActions}
      commandSectionLabel={commandSectionLabel}
      homeHref={homeHref}
      collapsed={collapsed}
      visibleGroupId={hasStructuredPrimaryNav ? activePrimaryItemId : undefined}
      showBrand={!hasStructuredPrimaryNav}
      panelTitle={nestedSidebarTitle}
      panelDetail={nestedSidebarDetail}
      hiddenItemIds={collapsed || !hidePrimaryRailItems ? undefined : desktopHiddenItemIds}
    />
  );

  return (
    <div className={cn("min-h-screen bg-background text-foreground", className)}>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden overflow-hidden border-r border-border bg-card transition-[width] duration-200 ease-linear md:flex",
          hasStructuredPrimaryNav
            ? desktopOpen ? "w-[20rem]" : "w-[3.75rem]"
            : desktopOpen ? "w-[18rem]" : "w-[3.75rem]",
        )}
      >
        {hasStructuredPrimaryNav ? (
          <PrismMainSidebar
            productLabel={productLabel}
            roleLabel={roleLabel}
            items={primaryNavItems ?? []}
            activeItemId={activePrimaryItemId}
            onNavSelect={handleNavSelect}
            homeHref={homeHref}
          />
        ) : useSingleSidebar ? null : (
          <PrismIconRail
            productLabel={productLabel}
            activeItemId={activeItemId}
            navItems={navItems}
            onNavSelect={handleNavSelect}
            homeHref={homeHref}
            user={user}
            railItems={primaryRail.items}
          />
        )}
        {useSingleSidebar ? (
          renderSidebar(!desktopOpen)
        ) : desktopOpen ? (
          <div className="min-w-0 flex-1 bg-card">
            {renderSidebar(false, true)}
          </div>
        ) : null}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" data-state="open">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/35"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className={cn(
              "relative h-full border-r border-primary/15 bg-card shadow-2xl",
              hasStructuredPrimaryNav ? "w-[min(100vw,20rem)]" : "w-80 max-w-[86vw]",
            )}
          >
            {hasStructuredPrimaryNav ? (
              <div className="flex h-full">
                <PrismMainSidebar
                  productLabel={productLabel}
                  roleLabel={roleLabel}
                  items={primaryNavItems ?? []}
                  activeItemId={activePrimaryItemId}
                  onNavSelect={handleNavSelect}
                  homeHref={homeHref}
                />
                <div className="min-w-0 flex-1">
                  {renderSidebar(false)}
                </div>
              </div>
            ) : (
              renderSidebar(false)
            )}
            <PrismButton
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 text-foreground"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
              <X aria-hidden="true" />
            </PrismButton>
          </aside>
        </div>
      ) : null}

      <main
        className={cn(
          "min-h-screen transition-[padding-left] duration-200 ease-linear",
          hasStructuredPrimaryNav
            ? desktopOpen ? "md:pl-[20rem]" : "md:pl-[3.75rem]"
            : desktopOpen ? "md:pl-[18rem]" : "md:pl-[3.75rem]",
        )}
      >
        <PrismTopBar
          eyebrow={eyebrow}
          title={title}
          description={description}
          searchPlaceholder={searchPlaceholder}
          headerActions={headerActions}
          accountMenuItems={accountMenuItems}
          user={user}
          onSignOut={onSignOut}
          onOpenMobileNav={() => setMobileOpen(true)}
          onToggleDesktopNav={() => setDesktopOpen((open) => !open)}
          sidebarCollapsed={!desktopOpen}
        />
        <MobileActionDock actions={mobileActions} />
        <div
          className={cn(
            "mx-auto grid w-full max-w-[1360px] gap-4 p-4 sm:p-5",
            rightRail ? "xl:grid-cols-[minmax(0,1fr)_22rem]" : "",
            contentClassName,
          )}
        >
          <section className="min-w-0">{children}</section>
          {rightRail ? <aside className="min-w-0 xl:border-l xl:border-border xl:pl-5">{rightRail}</aside> : null}
        </div>
      </main>

    </div>
  );
}
