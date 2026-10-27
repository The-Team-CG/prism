"use client";

import { Bell, PanelLeft, Search } from "lucide-react";
import * as React from "react";
import { PrismAccountMenu } from "./account-menu";
import { PrismBadge, PrismButton } from "../primitives";
import { cn } from "../utils";
import type {
  PrismAccountMenuItem,
  PrismAppShellProps,
  PrismMobileAction,
  PrismUserSummary,
} from "./types";
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
          <span className="absolute right-1 top-1 size-1.5 rounded-full bg-attention ring-2 ring-card" aria-hidden="true" />
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
            className="flex h-14 flex-col items-center justify-center gap-1 rounded-md text-2xs font-bold text-muted-foreground transition hover:bg-primary hover:text-primary-foreground focus-visible:bg-primary focus-visible:text-primary-foreground active:bg-primary active:text-primary-foreground disabled:opacity-45 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
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
            <p className="text-3xs font-black uppercase text-muted-foreground">{eyebrow}</p>
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
