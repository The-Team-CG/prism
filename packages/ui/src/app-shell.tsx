"use client";

import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CalendarDays,
  CircleUserRound,
  FileText,
  LogOut,
  PanelLeft,
  Search,
  Settings,
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
  user?: PrismUserSummary;
  searchPlaceholder?: string;
  commandActions?: PrismPageAction[];
  commandSectionLabel?: string;
  headerActions?: React.ReactNode;
  accountMenuItems?: PrismAccountMenuItem[];
  rightRail?: React.ReactNode;
  mobileActions?: PrismMobileAction[];
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
}) {
  const navGroups = navItems.reduce<Array<{ section: string; items: PrismNavItem[] }>>((groups, item) => {
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
      <PrismBrandLogo
        href={homeHref}
        title={productLabel.endsWith(".") ? productLabel : `${productLabel}.`}
        detail={roleLabel}
        compact={collapsed}
        className={cn("min-h-16 px-4", collapsed && "justify-center px-2")}
        markClassName="size-9 bg-transparent ring-0"
      />

      <nav className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 pb-4 pt-1">
        {navGroups.map((group, groupIndex) => (
          <div key={group.section} className={cn("flex flex-col gap-1.5", groupIndex > 0 && "mt-6")}>
            <p className={cn("px-1.5 pb-1 text-[11px] font-black uppercase text-primary", collapsed && "sr-only")}>
              {group.section}
            </p>
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                aria-current={item.id === activeItemId ? "page" : undefined}
                data-active={item.id === activeItemId}
                onClick={() => onNavSelect?.(item.id)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex h-9 w-full items-center gap-2 overflow-hidden rounded-md px-2 text-left text-sm font-semibold text-muted-foreground transition hover:bg-primary hover:text-primary-foreground focus-visible:bg-primary focus-visible:text-primary-foreground active:bg-primary active:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45 data-[active=true]:bg-primary data-[active=true]:font-bold data-[active=true]:text-primary-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <item.icon aria-hidden="true" className="size-3.5 shrink-0" />
                <span className={cn("min-w-0 flex-1 truncate", collapsed && "sr-only")}>{item.label}</span>
                {item.badge && !collapsed ? (
                  <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-black leading-none text-foreground ring-1 ring-border">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            ))}
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
                className="group flex min-h-8 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-semibold text-muted-foreground transition hover:bg-primary hover:text-primary-foreground focus-visible:bg-primary focus-visible:text-primary-foreground active:bg-primary active:text-primary-foreground"
              >
                {action.icon ? <action.icon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{action.label}</span>
                  {action.description ? (
                    <span className="block truncate text-[11px] font-medium text-muted-foreground group-hover:text-primary-foreground/75">
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
  user,
  searchPlaceholder,
  commandActions,
  commandSectionLabel,
  headerActions,
  accountMenuItems,
  rightRail,
  mobileActions = [],
  children,
  className,
  contentClassName,
  homeHref,
  onSignOut,
}: PrismAppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [desktopOpen, setDesktopOpen] = React.useState(true);

  const renderSidebar = (collapsed = false) => (
    <PrismSidebar
      productLabel={productLabel}
      roleLabel={roleLabel}
      activeItemId={activeItemId}
      navItems={navItems}
      onNavSelect={(id) => {
        onNavSelect?.(id);
        setMobileOpen(false);
      }}
      commandActions={commandActions}
      commandSectionLabel={commandSectionLabel}
      homeHref={homeHref}
      collapsed={collapsed}
    />
  );

  return (
    <div className={cn("min-h-screen bg-background text-foreground", className)}>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-primary/15 bg-card transition-[width] duration-200 ease-linear md:flex",
          desktopOpen ? "w-64" : "w-16",
        )}
      >
        {renderSidebar(!desktopOpen)}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" data-state="open">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/35"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative h-full w-80 max-w-[86vw] border-r border-primary/15 bg-card shadow-2xl">
            {renderSidebar(false)}
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
          desktopOpen ? "md:pl-64" : "md:pl-16",
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
