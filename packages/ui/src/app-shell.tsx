"use client";

import type { LucideIcon } from "lucide-react";
import { Bell, LogOut, Menu, Search, Sparkles, X } from "lucide-react";
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
  activeItemLabel?: string;
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
  user,
  commandActions = [],
  commandSectionLabel = "Workflows",
  onSignOut,
  homeHref = "/",
}: Pick<
  PrismAppShellProps,
  | "productLabel"
  | "roleLabel"
  | "activeItemId"
  | "navItems"
  | "onNavSelect"
  | "user"
  | "commandActions"
  | "commandSectionLabel"
  | "onSignOut"
  | "homeHref"
>) {
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
    <div className="flex h-full flex-col bg-card text-foreground">
      <a
        href={homeHref}
        className="flex items-center gap-2.5 px-4 py-4 text-foreground no-underline"
      >
        <span className="grid size-8 place-items-center rounded-md bg-foreground text-xs font-black text-background shadow-sm">
          P
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-black leading-4 text-foreground">
            {productLabel.endsWith(".") ? productLabel : `${productLabel}.`}
          </span>
          <span className="block truncate text-[11px] font-semibold leading-4 text-muted-foreground">
            {roleLabel}
          </span>
        </span>
      </a>

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3 pt-1">
        {navGroups.map((group, groupIndex) => (
          <div key={group.section} className={cn("flex flex-col gap-1", groupIndex > 0 && "mt-5")}>
            <p className="px-2.5 pb-1.5 text-[10px] font-black uppercase text-muted-foreground">
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
                className="flex h-8 items-center gap-2 rounded-md px-2.5 text-left text-[13px] font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 data-[active=true]:bg-foreground data-[active=true]:font-bold data-[active=true]:text-background data-[active=true]:shadow-sm"
              >
                <item.icon aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-black leading-none text-foreground ring-1 ring-border">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ))}

        {commandActions.length ? (
          <div className="mt-5 flex flex-col gap-1">
            <p className="px-2.5 pb-1.5 text-[10px] font-black uppercase text-muted-foreground">
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

      <div className="border-t border-border px-3 py-3">
        <div className="rounded-md border border-border bg-background p-3">
          <div className="mb-3 grid h-16 place-items-center rounded-md bg-secondary/70">
            <span className="grid size-9 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm">
              <Sparkles aria-hidden="true" className="size-4" />
            </span>
          </div>
          <p className="truncate text-[13px] font-black text-foreground">{user?.name ?? "PMCM workspace"}</p>
          <p className="truncate text-[11px] font-semibold text-muted-foreground">
            {user?.detail ?? roleLabel}
          </p>
          {onSignOut ? (
            <button
              type="button"
              className="mt-3 inline-flex h-8 w-full items-center justify-center gap-2 rounded-md bg-foreground px-3 text-xs font-bold text-background transition hover:opacity-90"
              onClick={onSignOut}
            >
              <LogOut aria-hidden="true" className="size-3.5" />
              Sign out
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PrismTopBar({
  eyebrow,
  title,
  description,
  activeItemLabel,
  searchPlaceholder,
  headerActions,
  user,
  onOpenNav,
}: Pick<
  PrismAppShellProps,
  "eyebrow" | "title" | "description" | "activeItemLabel" | "searchPlaceholder" | "headerActions" | "user"
> & {
  onOpenNav?: () => void;
}) {
  const placeholder = searchPlaceholder ?? "Search";

  return (
    <header
      className="sticky top-0 z-30 h-14 border-b border-border bg-card/95 px-3 backdrop-blur sm:px-4"
      aria-label={`${eyebrow}: ${title}`}
    >
      <div className="flex h-full items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {onOpenNav ? (
            <PrismButton
              variant="outline"
              size="icon"
              className="size-8 bg-background lg:hidden"
              onClick={onOpenNav}
              aria-label="Open navigation"
            >
              <Menu aria-hidden="true" />
            </PrismButton>
          ) : null}
          <label className="relative w-full max-w-[14rem] sm:max-w-[18rem]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-[13px] font-medium outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
              placeholder={placeholder}
            />
            <span className="sr-only">
              {description ? `${title}. ${description}` : title}
            </span>
          </label>
        </div>
        {headerActions ? <div className="hidden shrink-0 items-center gap-2 md:flex">{headerActions}</div> : null}
        {activeItemLabel ? (
          <PrismBadge variant="secondary" className="hidden h-7 rounded-md px-2.5 text-[11px] md:inline-flex">
            {activeItemLabel}
          </PrismBadge>
        ) : null}
        <button
          type="button"
          className="relative grid size-8 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell aria-hidden="true" className="size-3.5" />
          {activeItemLabel ? (
            <span className="absolute right-2 top-2 size-1.5 rounded-full bg-foreground" aria-hidden="true" />
          ) : null}
        </button>
        {user ? (
          <div className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-background">
            <span className="grid size-6 place-items-center rounded-full bg-foreground text-[9px] font-black text-background">
              {user.initials ?? initialsFor(user.name)}
            </span>
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
    <div className="mx-4 mt-4 rounded-lg border border-border bg-card p-1.5 shadow-sm sm:mx-5 lg:hidden">
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
  activeItemLabel,
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
  onSignOut,
  children,
  className,
  contentClassName,
  homeHref,
}: PrismAppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const sidebar = (
    <PrismSidebar
      productLabel={productLabel}
      roleLabel={roleLabel}
      activeItemId={activeItemId}
      navItems={navItems}
      onNavSelect={(id) => {
        onNavSelect?.(id);
        setMobileOpen(false);
      }}
      user={user}
      commandActions={commandActions}
      commandSectionLabel={commandSectionLabel}
      onSignOut={onSignOut}
      homeHref={homeHref}
    />
  );

  return (
    <div className={cn("min-h-screen bg-background text-foreground", className)}>
      <aside className="fixed inset-y-0 left-0 hidden w-56 border-r border-border bg-card lg:block">
        {sidebar}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" data-state="open">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/35"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative h-full w-80 max-w-[86vw] border-r border-border bg-card shadow-2xl">
            {sidebar}
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

      <main className="lg:pl-56">
        <PrismTopBar
          eyebrow={eyebrow}
          title={title}
          description={description}
          activeItemLabel={activeItemLabel}
          searchPlaceholder={searchPlaceholder}
          headerActions={headerActions}
          user={user}
          onOpenNav={() => setMobileOpen(true)}
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
