"use client";

import { X } from "lucide-react";
import * as React from "react";
import { PrismButton } from "../primitives";
import { cn } from "../utils";
import { PrismMainSidebar } from "./sidebar";
import type { PrismPrimaryNavItem, ShellSidebarRenderer } from "./types";


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
  renderSidebar: ShellSidebarRenderer;
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

export function PrismMobileNavOverlay({
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
  renderSidebar: ShellSidebarRenderer;
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
