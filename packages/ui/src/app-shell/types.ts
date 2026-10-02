import type { LucideIcon } from "lucide-react";
import type * as React from "react";
export interface PrismNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  section?: string;
  groupId?: string;
  badge?: string | number;
  disabled?: boolean;
  subItems?: PrismNavSubItem[];
}

export interface PrismNavSubItem {
  id: string;
  label: string;
  badge?: string | number;
  disabled?: boolean;
}

export interface PrismPrimaryNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  targetId?: string;
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

export interface PrismSidebarRenderProps {
  collapsed: boolean;
  mobile: boolean;
}

export type ShellSidebarRenderer = (collapsed?: boolean, hidePrimaryRailItems?: boolean) => React.ReactNode;

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
  primaryNavItems?: PrismPrimaryNavItem[];
  activePrimaryItemId?: string;
  nestedSidebarTitle?: string;
  nestedSidebarDetail?: string;
  user?: PrismUserSummary;
  searchPlaceholder?: string;
  showTopBarSearch?: boolean;
  commandActions?: PrismPageAction[];
  commandSectionLabel?: string;
  headerActions?: React.ReactNode;
  accountMenuItems?: PrismAccountMenuItem[];
  rightRail?: React.ReactNode;
  mobileActions?: PrismMobileAction[];
  sidebarMode?: "auto" | "single";
  sidebarContent?: React.ReactNode | ((props: PrismSidebarRenderProps) => React.ReactNode);
  onSignOut?: () => void;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  homeHref?: string;
}
