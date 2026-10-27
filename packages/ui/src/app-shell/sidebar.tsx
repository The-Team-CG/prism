"use client";

import { Search, Settings } from "lucide-react";
import * as React from "react";
import { PrismBrandLogo } from "../brand";
import { cn } from "../utils";
import { buildPrimaryRail, navSearchText, type PrismRailItem } from "./navigation-model";
import type { PrismAppShellProps, PrismNavItem, PrismPageAction, PrismPrimaryNavItem } from "./types";
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
            <span className="rounded-full bg-background px-1.5 py-0.5 text-3xs font-black leading-none text-muted-foreground ring-1 ring-border">
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
          <span className="rounded-full bg-background px-1.5 py-0.5 text-3xs font-black leading-none text-muted-foreground ring-1 ring-border">
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
          <p className={cn("px-2 pb-1 text-2xs font-semibold uppercase text-muted-foreground", collapsed && "sr-only")}>
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
      <p className="px-1.5 pb-1 text-2xs font-black uppercase text-primary">
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
              <span className="block truncate text-2xs font-medium text-muted-foreground">
                {action.description}
              </span>
            ) : null}
          </span>
          {action.status ? (
            <span className="max-w-12 truncate rounded-full bg-background px-1.5 py-0.5 text-3xs font-black leading-none text-foreground ring-1 ring-border">
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

export function PrismIconRail({
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
              <span className="absolute right-1 top-1 size-1.5 rounded-full bg-attention ring-2 ring-background" aria-hidden="true" />
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

export function PrismMainSidebar({
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
