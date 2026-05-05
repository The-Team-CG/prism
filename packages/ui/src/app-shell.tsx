"use client";

import type { LucideIcon } from "lucide-react";
import { Bell, PanelLeft, Search, X } from "lucide-react";
import * as React from "react";
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
    <div className="flex h-full min-w-0 flex-col bg-card text-foreground">
      <a
        href={homeHref}
        className={cn(
          "flex min-h-16 items-center gap-2.5 px-3 text-foreground no-underline",
          collapsed && "justify-center px-2",
        )}
        title={collapsed ? productLabel : undefined}
      >
        <span className="grid size-8 place-items-center rounded-md bg-foreground text-xs font-black text-background shadow-sm">
          P
        </span>
        <span className={cn("min-w-0", collapsed && "sr-only")}>
          <span className="block truncate text-sm font-black leading-4 text-foreground">
            {productLabel.endsWith(".") ? productLabel : `${productLabel}.`}
          </span>
          <span className="block truncate text-[11px] font-semibold leading-4 text-muted-foreground">
            {roleLabel}
          </span>
        </span>
      </a>

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-3 pt-1">
        {navGroups.map((group, groupIndex) => (
          <div key={group.section} className={cn("flex flex-col gap-1", groupIndex > 0 && "mt-5")}>
            <p className={cn("px-2 pb-1.5 text-[11px] font-black uppercase text-muted-foreground", collapsed && "sr-only")}>
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
                  "flex h-9 w-full items-center gap-2 overflow-hidden rounded-md px-2 text-left text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 data-[active=true]:bg-foreground data-[active=true]:font-bold data-[active=true]:text-background",
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
          <div className="mt-5 flex flex-col gap-1">
            <p className="px-2 pb-1.5 text-[11px] font-black uppercase text-muted-foreground">
              {commandSectionLabel}
            </p>
            {commandActions.slice(0, 5).map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={action.onSelect}
                className="group flex min-h-8 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                {action.icon ? <action.icon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{action.label}</span>
                  {action.description ? (
                    <span className="block truncate text-[11px] font-medium text-muted-foreground group-hover:text-foreground/75">
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
  user,
  onOpenMobileNav,
  onToggleDesktopNav,
  sidebarCollapsed,
}: Pick<
  PrismAppShellProps,
  "eyebrow" | "title" | "description" | "searchPlaceholder" | "headerActions" | "user"
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
          <div className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-xs font-semibold text-foreground">
            {user.initials ?? initialsFor(user.name)}
          </div>
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
            className="flex h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-bold text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-45 data-[active=true]:bg-foreground data-[active=true]:text-background"
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
  rightRail,
  mobileActions = [],
  children,
  className,
  contentClassName,
  homeHref,
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
          "fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-card transition-[width] duration-200 ease-linear md:flex",
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
          <aside className="relative h-full w-80 max-w-[86vw] border-r border-border bg-card shadow-2xl">
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
          user={user}
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
