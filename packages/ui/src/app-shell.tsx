"use client";

import type { LucideIcon } from "lucide-react";
import { Menu, Search, X } from "lucide-react";
import * as React from "react";
import { PrismBadge, PrismButton } from "./primitives";
import { cn } from "./utils";

export interface PrismNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
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
  headerActions?: React.ReactNode;
  rightRail?: React.ReactNode;
  mobileActions?: PrismMobileAction[];
  onSignOut?: () => void;
  children: React.ReactNode;
  className?: string;
}

function initialsFor(name?: string) {
  if (!name) return "PM";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "PM";
}

export function PrismSidebar({
  productLabel = "P.R.I.S.M",
  roleLabel,
  activeItemId,
  navItems,
  onNavSelect,
  user,
  commandActions = [],
  onSignOut,
}: Pick<
  PrismAppShellProps,
  "productLabel" | "roleLabel" | "activeItemId" | "navItems" | "onNavSelect" | "user" | "commandActions" | "onSignOut"
>) {
  return (
    <div className="flex h-full flex-col gap-5 bg-sidebar p-4 text-sidebar-foreground">
      <a href="/" className="flex items-center gap-3 rounded-md px-1 py-1 text-sidebar-foreground no-underline">
        <span className="grid size-10 place-items-center rounded-md border border-white/10 bg-white text-sm font-black text-foreground shadow-sm">
          P
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-black uppercase tracking-[0.18em] text-sidebar-primary">{productLabel}</span>
          <span className="block truncate text-xs text-sidebar-foreground/68">{roleLabel}</span>
        </span>
      </a>

      {user ? (
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/7 p-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-card text-xs font-black text-foreground">
            {user.initials ?? initialsFor(user.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black">{user.name}</span>
            {user.detail ? <span className="block truncate text-xs text-sidebar-foreground/62">{user.detail}</span> : null}
          </span>
        </div>
      ) : null}

      <nav className="flex min-h-0 flex-1 flex-col gap-1">
        <p className="px-3 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-sidebar-primary">Navigation</p>
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            data-active={item.id === activeItemId}
            onClick={() => onNavSelect?.(item.id)}
            className="flex h-10 items-center gap-3 rounded-md px-3 text-left text-sm font-bold text-sidebar-foreground/76 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:cursor-not-allowed disabled:opacity-45 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
          >
            <item.icon aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.badge ? (
              <span className="rounded-full bg-sidebar-primary px-2 py-0.5 text-[11px] font-black text-sidebar-primary-foreground">
                {item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {commandActions.length ? (
        <div className="rounded-lg border border-sidebar-border bg-white/6 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sidebar-primary">Action queue</p>
          <div className="mt-3 flex flex-col gap-2">
            {commandActions.slice(0, 4).map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={action.onSelect}
                className="rounded-md border border-white/10 bg-white/5 p-2 text-left transition hover:border-sidebar-primary/35 hover:bg-white/10"
              >
                <span className="flex items-center gap-2 text-xs font-black">
                  {action.icon ? <action.icon aria-hidden="true" /> : null}
                  <span className="truncate">{action.label}</span>
                </span>
                {action.description ? (
                  <span className="mt-1 block line-clamp-2 text-[11px] leading-4 text-sidebar-foreground/65">
                    {action.description}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {onSignOut ? (
        <PrismButton variant="outline" className="w-full border-white/15 bg-transparent text-sidebar-foreground hover:bg-white/10" onClick={onSignOut}>
          Sign out
        </PrismButton>
      ) : null}
    </div>
  );
}

export function PrismTopBar({
  eyebrow,
  title,
  description,
  searchPlaceholder,
  headerActions,
  onOpenNav,
}: Pick<PrismAppShellProps, "eyebrow" | "title" | "description" | "searchPlaceholder" | "headerActions"> & {
  onOpenNav?: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/92 px-4 py-3 backdrop-blur sm:px-5">
      <div className="flex items-center gap-3">
        {onOpenNav ? (
          <PrismButton variant="outline" size="icon" className="lg:hidden" onClick={onOpenNav} aria-label="Open navigation">
            <Menu aria-hidden="true" />
          </PrismButton>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          <h1 className="truncate text-xl font-black text-foreground sm:text-2xl">{title}</h1>
          {description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {searchPlaceholder ? (
          <label className="relative hidden min-w-60 xl:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
              placeholder={searchPlaceholder}
            />
            <span className="sr-only">Search</span>
          </label>
        ) : null}
        {headerActions ? <div className="flex shrink-0 items-center gap-2">{headerActions}</div> : null}
      </div>
    </header>
  );
}

export function MobileActionDock({ actions }: { actions: PrismMobileAction[] }) {
  if (!actions.length) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-40 rounded-lg border border-border bg-card/95 p-1.5 shadow-2xl backdrop-blur lg:hidden">
      <div className="grid grid-cols-3 gap-1">
        {actions.slice(0, 3).map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={action.disabled}
            data-active={action.active}
            onClick={action.onSelect}
            className="flex h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-bold text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-45 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
          >
            <action.icon aria-hidden="true" />
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
    <section className={cn("rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">{eyebrow}</p> : null}
          <h2 className="mt-1 text-xl font-black leading-tight text-foreground sm:text-2xl">{title}</h2>
          {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
          {meta?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {meta.map((item, index) =>
                typeof item === "string" ? (
                  <PrismBadge key={`${item}-${index}`} variant="outline">{item}</PrismBadge>
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
  headerActions,
  rightRail,
  mobileActions = [],
  onSignOut,
  children,
  className,
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
      onSignOut={onSignOut}
    />
  );

  return (
    <div className={cn("min-h-screen bg-background text-foreground", className)}>
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-sidebar-border lg:block">{sidebar}</aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/35" onClick={() => setMobileOpen(false)} />
          <aside className="relative h-full w-80 max-w-[86vw] border-r border-sidebar-border shadow-2xl">
            {sidebar}
            <PrismButton variant="ghost" size="icon" className="absolute right-3 top-3 text-sidebar-foreground" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
              <X aria-hidden="true" />
            </PrismButton>
          </aside>
        </div>
      ) : null}

      <main className="lg:pl-72">
        <PrismTopBar
          eyebrow={eyebrow}
          title={title}
          description={description}
          searchPlaceholder={searchPlaceholder}
          headerActions={headerActions}
          onOpenNav={() => setMobileOpen(true)}
        />
        <div className={cn("grid gap-5 p-4 pb-24 sm:p-5 lg:pb-5", rightRail ? "xl:grid-cols-[minmax(0,1fr)_22rem]" : "")}>
          <section className="min-w-0">{children}</section>
          {rightRail ? <aside className="min-w-0">{rightRail}</aside> : null}
        </div>
      </main>

      <MobileActionDock actions={mobileActions} />
    </div>
  );
}
