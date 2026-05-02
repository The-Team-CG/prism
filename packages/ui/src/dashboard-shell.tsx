"use client";

import type { LucideIcon } from "lucide-react";
import { Menu } from "lucide-react";
import * as React from "react";
import { cn } from "./utils";

export interface PrismShellNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number | string;
}

export interface PrismCommandAction {
  id: string;
  label: string;
  description: string;
  status?: string;
  onSelect?: () => void;
}

export interface PrismDashboardShellProps {
  productLabel: string;
  roleLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  activeItemId: string;
  navItems: PrismShellNavItem[];
  onNavSelect: (id: string) => void;
  commandActions?: PrismCommandAction[];
  headerActions?: React.ReactNode;
  rightRail?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PrismDashboardShell({
  productLabel,
  roleLabel,
  eyebrow,
  title,
  description,
  activeItemId,
  navItems,
  onNavSelect,
  commandActions = [],
  headerActions,
  rightRail,
  children,
  className,
}: PrismDashboardShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const activeItem = navItems.find((item) => item.id === activeItemId) ?? navItems[0];

  const sidebar = (
    <div className="flex h-full flex-col gap-5 bg-sidebar p-4 text-sidebar-foreground">
      <div className="flex items-center gap-3 px-1">
        <span className="grid size-9 place-items-center rounded-md bg-sidebar-primary text-sm font-black text-sidebar-primary-foreground">
          P
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-black uppercase tracking-[0.18em] text-sidebar-primary">{productLabel}</p>
          <p className="truncate text-xs text-sidebar-foreground/70">{roleLabel}</p>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            data-active={item.id === activeItemId}
            onClick={() => {
              onNavSelect(item.id);
              setMobileOpen(false);
            }}
            className="flex h-10 items-center gap-3 rounded-md px-3 text-left text-sm font-bold text-sidebar-foreground/78 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
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
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sidebar-primary">Command queue</p>
          <div className="mt-3 flex flex-col gap-2">
            {commandActions.slice(0, 4).map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={action.onSelect}
                className="rounded-md border border-white/10 bg-white/5 p-2 text-left transition hover:border-sidebar-primary/35 hover:bg-white/10"
              >
                <span className="block truncate text-xs font-black">{action.label}</span>
                <span className="mt-1 block line-clamp-2 text-[11px] leading-4 text-sidebar-foreground/65">{action.description}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={cn("min-h-screen bg-background text-foreground", className)}>
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-sidebar-border lg:block">{sidebar}</aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/35" onClick={() => setMobileOpen(false)} />
          <aside className="relative h-full w-80 max-w-[86vw] border-r border-sidebar-border shadow-2xl">{sidebar}</aside>
        </div>
      ) : null}

      <main className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-border bg-card/92 px-4 py-3 backdrop-blur sm:px-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="grid size-9 place-items-center rounded-md border border-border bg-background text-foreground lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu aria-hidden="true" />
              <span className="sr-only">Open navigation</span>
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="truncate text-xl font-black text-foreground sm:text-2xl">{title}</h1>
                {activeItem ? <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-secondary-foreground">{activeItem.label}</span> : null}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{description}</p>
            </div>
            {headerActions ? <div className="flex shrink-0 items-center gap-2">{headerActions}</div> : null}
          </div>
        </header>

        <div className={cn("grid gap-5 p-4 sm:p-5", rightRail ? "xl:grid-cols-[minmax(0,1fr)_22rem]" : "")}>
          <section className="min-w-0">{children}</section>
          {rightRail ? <aside className="min-w-0">{rightRail}</aside> : null}
        </div>
      </main>
    </div>
  );
}
