"use client";

import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { PrismAppShell } from "./app-shell";

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
  contentClassName?: string;
  activeItemLabel?: string;
  homeHref?: string;
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
  contentClassName,
  activeItemLabel,
  homeHref,
}: PrismDashboardShellProps) {
  const activeItem = navItems.find((item) => item.id === activeItemId);

  return (
    <PrismAppShell
      productLabel={productLabel}
      roleLabel={roleLabel}
      eyebrow={eyebrow}
      title={title}
      description={description}
      activeItemLabel={activeItemLabel ?? activeItem?.label}
      activeItemId={activeItemId}
      navItems={navItems}
      onNavSelect={onNavSelect}
      commandActions={commandActions}
      headerActions={headerActions}
      rightRail={rightRail}
      className={className}
      contentClassName={contentClassName}
      homeHref={homeHref}
    >
      {children}
    </PrismAppShell>
  );
}
