"use client";

import * as React from "react";
import { cn } from "../utils";
import { buildPrimaryRail, type PrismRailItem } from "./navigation-model";
import { PrismIconRail, PrismMainSidebar, PrismSidebar } from "./sidebar";
import { PrismMobileNavOverlay } from "./mobile-nav";
import { MobileActionDock, PrismTopBar } from "./top-bar";
import type {
  PrismAccountMenuItem,
  PrismAppShellProps,
  PrismMobileAction,
  PrismNavItem,
  PrismPrimaryNavItem,
  ShellSidebarRenderer,
  PrismUserSummary,
} from "./types";
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
  return desktopOpen ? "w-[var(--prism-shell-sidebar-width,18rem)]" : "w-[3.75rem]";
}

function mainPaddingClass(hasStructured: boolean, desktopOpen: boolean) {
  if (hasStructured) return desktopOpen ? "md:pl-[20rem]" : "md:pl-[3.75rem]";
  return desktopOpen ? "md:pl-[var(--prism-shell-sidebar-width,18rem)]" : "md:pl-[3.75rem]";
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
  renderSidebar: ShellSidebarRenderer;
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
