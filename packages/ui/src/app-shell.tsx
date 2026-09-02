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

export interface PrismSidebarRenderProps {
  collapsed: boolean;
  mobile: boolean;
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
  showTopBarSearch?: boolean;
  commandActions?: PrismPageAction[];
  commandSectionLabel?: string;
  headerActions?: React.ReactNode;
  accountMenuItems?: PrismAccountMenuItem[];
  rightRail?: React.ReactNode;
  mobileActions?: PrismMobileAction[];
  sidebarMode?: "auto" | "single";
  sidebarContent?: React.ReactNode | ((props: PrismSidebarRenderProps) => React.ReactNode);
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

function buildPrimaryRail(navItems: PrismNavItem[], activeItemId: string) {
  const candidates = PRIMARY_RAIL_SPECS.map((spec) => resolveRailCandidate(spec, navItems)).filter(
    (item): item is NonNullable<typeof item> => item !== null,
  );
  return uniqueRailItems(candidates, activeItemId);
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

function groupedNavItems(items: PrismNavItem[]) {
  return items.reduce<Array<{ section: string; items: PrismNavItem[] }>>((groups, item) => {
    const section = item.section ?? "Dashboards";
    const existing = groups.find((group) => group.section === section);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({ section, items: [item] });
    }
    return groups;
  }, []);
}

function filterSidebarNavItems(
  navItems: PrismNavItem[],
  visibleGroupId: string | undefined,
  hiddenItemIds: ReadonlySet<string> | undefined,
  navQuery: string,
) {
  const grouped = visibleGroupId ? navItems.filter((item) => item.groupId === visibleGroupId) : navItems;
  const visible = hiddenItemIds?.size ? grouped.filter((item) => !hiddenItemIds.has(item.id)) : grouped;
  const query = navQuery.trim().toLowerCase();
  const searched = query ? visible.filter((item) => navSearchText(item).includes(query)) : visible;
  return groupedNavItems(searched);
}

function SidebarBrandHeader({
  productLabel,
  roleLabel,
  homeHref,
  collapsed,
}: {
  productLabel: string;
  roleLabel: string;
  homeHref: string;
  collapsed: boolean;
}) {
  return (
    <PrismBrandLogo
      href={homeHref}
      title={productLabel.endsWith(".") ? productLabel : `${productLabel}.`}
      detail={roleLabel}
      compact={collapsed}
      className={cn("min-h-16 px-3", collapsed && "justify-center px-2")}
      markClassName="size-8 bg-transparent ring-0"
    />
  );
}

function SidebarPanelHeader({
  roleLabel,
  panelTitle,
  panelDetail,
}: {
  roleLabel: string;
  panelTitle?: string;
  panelDetail?: string;
}) {
  return (
    <div className="min-h-16 border-b border-border px-4 py-4">
      <p className="truncate text-sm font-black text-foreground">{panelTitle ?? roleLabel}</p>
      {panelDetail ? <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{panelDetail}</p> : null}
    </div>
  );
}

function SidebarSearch({
  collapsed,
  showBrand,
  navQuery,
  onNavQueryChange,
}: {
  collapsed: boolean;
  showBrand: boolean;
  navQuery: string;
  onNavQueryChange: (value: string) => void;
}) {
  if (collapsed || !showBrand) return null;
  return (
    <div className="px-3 pb-3">
      <label className="relative block">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={navQuery}
          onChange={(event) => onNavQueryChange(event.target.value)}
          className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          placeholder="Find page"
          aria-label="Search navigation"
        />
      </label>
    </div>
  );
}

function SidebarNavSubItems({
  item,
  activeItemId,
  collapsed,
  onNavSelect,
}: {
  item: PrismNavItem;
  activeItemId: string;
  collapsed: boolean;
  onNavSelect?: (id: string) => void;
}) {
  if (!item.subItems?.length || collapsed) return null;
  return (
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
  );
}

function SidebarNavItemButton({
  item,
  activeItemId,
  collapsed,
  onNavSelect,
}: {
  item: PrismNavItem;
  activeItemId: string;
  collapsed: boolean;
  onNavSelect?: (id: string) => void;
}) {
  const subItemActive = item.subItems?.some((subItem) => subItem.id === activeItemId) ?? false;
  const itemActive = item.id === activeItemId || subItemActive;

  return (
    <div className="min-w-0">
      <button
        type="button"
        disabled={item.disabled}
        aria-current={item.id === activeItemId ? "page" : undefined}
        data-active={itemActive}
        onClick={() => onNavSelect?.(item.id)}
        title={collapsed ? item.label : undefined}
        className={cn(
          "flex h-9 w-full items-center gap-2.5 overflow-hidden rounded-md px-2.5 text-left text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:bg-secondary focus-visible:text-foreground active:bg-secondary disabled:cursor-not-allowed disabled:opacity-45 data-[active=true]:bg-primary/10 data-[active=true]:font-semibold data-[active=true]:text-primary",
          collapsed && "justify-center px-0",
        )}
      >
        <item.icon aria-hidden="true" className="size-4 shrink-0" />
        <span className={cn("min-w-0 flex-1 truncate", collapsed && "sr-only")}>{item.label}</span>
        {item.badge && !collapsed ? (
          <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-black leading-none text-muted-foreground ring-1 ring-border">
            {item.badge}
          </span>
        ) : null}
      </button>
      <SidebarNavSubItems item={item} activeItemId={activeItemId} collapsed={collapsed} onNavSelect={onNavSelect} />
    </div>
  );
}

function SidebarNavGroups({
  navGroups,
  collapsed,
  activeItemId,
  onNavSelect,
}: {
  navGroups: Array<{ section: string; items: PrismNavItem[] }>;
  collapsed: boolean;
  activeItemId: string;
  onNavSelect?: (id: string) => void;
}) {
  if (!navGroups.length) {
    return (
      <p className={cn("px-2 py-3 text-sm font-medium text-muted-foreground", collapsed && "sr-only")}>
        No matching pages
      </p>
    );
  }

  return (
    <>
      {navGroups.map((group, groupIndex) => (
        <div key={group.section} className={cn("flex flex-col gap-1", groupIndex > 0 && "mt-5")}>
          <p className={cn("px-2 pb-1 text-[11px] font-semibold uppercase text-muted-foreground", collapsed && "sr-only")}>
            {group.section}
          </p>
          {group.items.map((item) => (
            <SidebarNavItemButton
              key={item.id}
              item={item}
              activeItemId={activeItemId}
              collapsed={collapsed}
              onNavSelect={onNavSelect}
            />
          ))}
        </div>
      ))}
    </>
  );
}

function SidebarCommandList({
  commandActions,
  commandSectionLabel,
  collapsed,
}: {
  commandActions: PrismPageAction[];
  commandSectionLabel: string;
  collapsed: boolean;
}) {
  if (!commandActions.length || collapsed) return null;
  return (
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
  const [navQuery, setNavQuery] = React.useState("");
  const navGroups = filterSidebarNavItems(navItems, visibleGroupId, hiddenItemIds, navQuery);
  const header = showBrand ? (
    <SidebarBrandHeader productLabel={productLabel} roleLabel={roleLabel} homeHref={homeHref} collapsed={collapsed} />
  ) : (
    <SidebarPanelHeader roleLabel={roleLabel} panelTitle={panelTitle} panelDetail={panelDetail} />
  );

  return (
    <div className="flex h-full w-full min-w-0 flex-col bg-card text-foreground">
      {header}
      <SidebarSearch collapsed={collapsed} showBrand={showBrand} navQuery={navQuery} onNavQueryChange={setNavQuery} />
      <nav className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-3 pb-4 pt-1">
        <SidebarNavGroups navGroups={navGroups} collapsed={collapsed} activeItemId={activeItemId} onNavSelect={onNavSelect} />
        <SidebarCommandList commandActions={commandActions} commandSectionLabel={commandSectionLabel} collapsed={collapsed} />
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
  railItems,
}: Pick<
  PrismAppShellProps,
  "productLabel" | "activeItemId" | "navItems" | "onNavSelect" | "homeHref"
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
  showSearch = true,
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
  showSearch?: boolean;
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
          {showSearch ? (
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
          ) : (
            <div className="min-w-0 flex-1 py-0.5">
              <p className="truncate text-sm font-semibold leading-5 text-foreground">{title}</p>
              {description ? (
                <p className="truncate text-xs leading-4 text-muted-foreground">{description}</p>
              ) : null}
            </div>
          )}
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

const HIDDEN_DESKTOP_NAV_IDS = new Set(["supplier-directory", "file-hub", "audit-log", "settings"]);

function shouldHideDesktopNavId(id: string) {
  return id.startsWith("command-") || id.endsWith("-desk") || HIDDEN_DESKTOP_NAV_IDS.has(id);
}

function desktopHiddenNavIds(hasStructuredPrimaryNav: boolean, navCount: number, targetIds: Set<string>) {
  if (hasStructuredPrimaryNav || navCount <= 6) return new Set<string>();
  return new Set(Array.from(targetIds).filter(shouldHideDesktopNavId));
}

function canUseStructuredPrimaryNav(
  sidebarMode: PrismAppShellProps["sidebarMode"],
  primaryNavItems?: PrismPrimaryNavItem[],
) {
  return sidebarMode !== "single" && Boolean(primaryNavItems?.length);
}

function desktopAsideWidthClass(hasStructured: boolean, desktopOpen: boolean) {
  if (hasStructured) return desktopOpen ? "w-[20rem]" : "w-[3.75rem]";
  return desktopOpen ? "w-[18rem]" : "w-[3.75rem]";
}

function mainPaddingClass(hasStructured: boolean, desktopOpen: boolean) {
  if (hasStructured) return desktopOpen ? "md:pl-[20rem]" : "md:pl-[3.75rem]";
  return desktopOpen ? "md:pl-[18rem]" : "md:pl-[3.75rem]";
}

function DesktopPrimaryColumn({
  hasStructuredPrimaryNav,
  useSingleSidebar,
  productLabel,
  roleLabel,
  primaryNavItems,
  activePrimaryItemId,
  activeItemId,
  navItems,
  homeHref,
  railItems,
  onNavSelect,
}: {
  hasStructuredPrimaryNav: boolean;
  useSingleSidebar: boolean;
  productLabel?: string;
  roleLabel: string;
  primaryNavItems?: PrismPrimaryNavItem[];
  activePrimaryItemId?: string;
  activeItemId: string;
  navItems: PrismNavItem[];
  homeHref?: string;
  railItems: PrismRailItem[];
  onNavSelect: (id: string) => void;
}) {
  if (hasStructuredPrimaryNav) {
    return (
      <PrismMainSidebar
        productLabel={productLabel}
        roleLabel={roleLabel}
        items={primaryNavItems ?? []}
        activeItemId={activePrimaryItemId}
        onNavSelect={onNavSelect}
        homeHref={homeHref}
      />
    );
  }
  if (useSingleSidebar) return null;
  return (
    <PrismIconRail
      productLabel={productLabel}
      activeItemId={activeItemId}
      navItems={navItems}
      onNavSelect={onNavSelect}
      homeHref={homeHref}
      railItems={railItems}
    />
  );
}

function DesktopSecondaryColumn({
  useSingleSidebar,
  desktopOpen,
  sidebarContent,
  renderSidebar,
}: {
  useSingleSidebar: boolean;
  desktopOpen: boolean;
  sidebarContent: React.ReactNode;
  renderSidebar: (collapsed?: boolean, hidePrimaryRailItems?: boolean) => React.ReactNode;
}) {
  if (useSingleSidebar) return sidebarContent;
  if (desktopOpen) {
    return <div className="min-w-0 flex-1 bg-card">{renderSidebar(false, true)}</div>;
  }
  return null;
}

function PrismDesktopAside({
  hasStructuredPrimaryNav,
  desktopOpen,
  children,
}: {
  hasStructuredPrimaryNav: boolean;
  desktopOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden overflow-hidden border-r border-border bg-card transition-[width] duration-200 ease-linear md:flex",
        desktopAsideWidthClass(hasStructuredPrimaryNav, desktopOpen),
      )}
    >
      {children}
    </aside>
  );
}

function MobileNavBody({
  hasStructuredPrimaryNav,
  productLabel,
  roleLabel,
  primaryNavItems,
  activePrimaryItemId,
  homeHref,
  onNavSelect,
  renderSidebar,
  sidebarContent,
}: {
  hasStructuredPrimaryNav: boolean;
  productLabel?: string;
  roleLabel: string;
  primaryNavItems?: PrismPrimaryNavItem[];
  activePrimaryItemId?: string;
  homeHref?: string;
  onNavSelect: (id: string) => void;
  renderSidebar: (collapsed?: boolean, hidePrimaryRailItems?: boolean) => React.ReactNode;
  sidebarContent: React.ReactNode;
}) {
  if (hasStructuredPrimaryNav) {
    return (
      <div className="flex h-full">
        <PrismMainSidebar
          productLabel={productLabel}
          roleLabel={roleLabel}
          items={primaryNavItems ?? []}
          activeItemId={activePrimaryItemId}
          onNavSelect={onNavSelect}
          homeHref={homeHref}
        />
        <div className="min-w-0 flex-1">{renderSidebar(false)}</div>
      </div>
    );
  }
  return sidebarContent;
}

function PrismMobileNavOverlay({
  mobileOpen,
  hasStructuredPrimaryNav,
  productLabel,
  roleLabel,
  primaryNavItems,
  activePrimaryItemId,
  homeHref,
  onNavSelect,
  renderSidebar,
  sidebarContent,
  onClose,
}: {
  mobileOpen: boolean;
  hasStructuredPrimaryNav: boolean;
  productLabel?: string;
  roleLabel: string;
  primaryNavItems?: PrismPrimaryNavItem[];
  activePrimaryItemId?: string;
  homeHref?: string;
  onNavSelect: (id: string) => void;
  renderSidebar: (collapsed?: boolean, hidePrimaryRailItems?: boolean) => React.ReactNode;
  sidebarContent: React.ReactNode;
  onClose: () => void;
}) {
  if (!mobileOpen) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden" data-state="open">
      <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/35" onClick={onClose} />
      <aside
        className={cn(
          "relative h-full border-r border-primary/15 bg-card shadow-2xl",
          hasStructuredPrimaryNav ? "w-[min(100vw,20rem)]" : "w-80 max-w-[86vw]",
        )}
      >
        <MobileNavBody
          hasStructuredPrimaryNav={hasStructuredPrimaryNav}
          productLabel={productLabel}
          roleLabel={roleLabel}
          primaryNavItems={primaryNavItems}
          activePrimaryItemId={activePrimaryItemId}
          homeHref={homeHref}
          onNavSelect={onNavSelect}
          renderSidebar={renderSidebar}
          sidebarContent={sidebarContent}
        />
        <PrismButton
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 text-foreground"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X aria-hidden="true" />
        </PrismButton>
      </aside>
    </div>
  );
}

function PrismShellMain({
  hasStructuredPrimaryNav,
  desktopOpen,
  eyebrow,
  title,
  description,
  searchPlaceholder,
  showTopBarSearch,
  headerActions,
  accountMenuItems,
  user,
  onSignOut,
  onOpenMobileNav,
  onToggleDesktopNav,
  mobileActions,
  rightRail,
  contentClassName,
  children,
}: {
  hasStructuredPrimaryNav: boolean;
  desktopOpen: boolean;
  eyebrow: string;
  title: string;
  description?: string;
  searchPlaceholder?: string;
  showTopBarSearch: boolean;
  headerActions?: React.ReactNode;
  accountMenuItems?: PrismAccountMenuItem[];
  user?: PrismUserSummary;
  onSignOut?: () => void;
  onOpenMobileNav: () => void;
  onToggleDesktopNav: () => void;
  mobileActions: PrismMobileAction[];
  rightRail?: React.ReactNode;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <main className={cn("min-h-screen transition-[padding-left] duration-200 ease-linear", mainPaddingClass(hasStructuredPrimaryNav, desktopOpen))}>
      <PrismTopBar
        eyebrow={eyebrow}
        title={title}
        description={description}
        searchPlaceholder={searchPlaceholder}
        showSearch={showTopBarSearch}
        headerActions={headerActions}
        accountMenuItems={accountMenuItems}
        user={user}
        onSignOut={onSignOut}
        onOpenMobileNav={onOpenMobileNav}
        onToggleDesktopNav={onToggleDesktopNav}
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
  showTopBarSearch = true,
  commandActions,
  commandSectionLabel,
  headerActions,
  accountMenuItems,
  rightRail,
  mobileActions = [],
  sidebarMode = "auto",
  sidebarContent,
  children,
  className,
  contentClassName,
  homeHref,
  onSignOut,
}: PrismAppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [desktopOpen, setDesktopOpen] = React.useState(true);
  const useSingleSidebar = sidebarMode === "single";
  const hasStructuredPrimaryNav = canUseStructuredPrimaryNav(sidebarMode, primaryNavItems);
  const primaryRail = React.useMemo(() => buildPrimaryRail(navItems, activeItemId), [navItems, activeItemId]);
  const desktopHiddenItemIds = React.useMemo(
    () => desktopHiddenNavIds(hasStructuredPrimaryNav, navItems.length, primaryRail.targetIds),
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

  const renderSidebarContent = (collapsed = false, mobile = false) => {
    if (!sidebarContent) return renderSidebar(collapsed);
    if (typeof sidebarContent === "function") return sidebarContent({ collapsed, mobile });
    return sidebarContent;
  };

  return (
    <div className={cn("min-h-screen bg-background text-foreground", className)}>
      <PrismDesktopAside hasStructuredPrimaryNav={hasStructuredPrimaryNav} desktopOpen={desktopOpen}>
        <DesktopPrimaryColumn
          hasStructuredPrimaryNav={hasStructuredPrimaryNav}
          useSingleSidebar={useSingleSidebar}
          productLabel={productLabel}
          roleLabel={roleLabel}
          primaryNavItems={primaryNavItems}
          activePrimaryItemId={activePrimaryItemId}
          activeItemId={activeItemId}
          navItems={navItems}
          homeHref={homeHref}
          railItems={primaryRail.items}
          onNavSelect={handleNavSelect}
        />
        <DesktopSecondaryColumn
          useSingleSidebar={useSingleSidebar}
          desktopOpen={desktopOpen}
          sidebarContent={renderSidebarContent(!desktopOpen)}
          renderSidebar={renderSidebar}
        />
      </PrismDesktopAside>
      <PrismMobileNavOverlay
        mobileOpen={mobileOpen}
        hasStructuredPrimaryNav={hasStructuredPrimaryNav}
        productLabel={productLabel}
        roleLabel={roleLabel}
        primaryNavItems={primaryNavItems}
        activePrimaryItemId={activePrimaryItemId}
        homeHref={homeHref}
        onNavSelect={handleNavSelect}
        renderSidebar={renderSidebar}
        sidebarContent={renderSidebarContent(false, true)}
        onClose={() => setMobileOpen(false)}
      />
      <PrismShellMain
        hasStructuredPrimaryNav={hasStructuredPrimaryNav}
        desktopOpen={desktopOpen}
        eyebrow={eyebrow}
        title={title}
        description={description}
        searchPlaceholder={searchPlaceholder}
        showTopBarSearch={showTopBarSearch}
        headerActions={headerActions}
        accountMenuItems={accountMenuItems}
        user={user}
        onSignOut={onSignOut}
        onOpenMobileNav={() => setMobileOpen(true)}
        onToggleDesktopNav={() => setDesktopOpen((open) => !open)}
        mobileActions={mobileActions}
        rightRail={rightRail}
        contentClassName={contentClassName}
      >
        {children}
      </PrismShellMain>
    </div>
  );
}

