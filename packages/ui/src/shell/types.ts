import type { LucideIcon } from "lucide-react";
import type * as React from "react";
export interface PrismNavItem {
  id: string;
  label: string;
  /** A shorter name for the phone tab bar, such as "Requests" for "Requests & quotes". */
  shortLabel?: string;
  icon: LucideIcon;
  section?: string;
  groupId?: string;
  badge?: string | number;
  /** Spoken name for the badge when its visible text is only a number, such as "3 unread messages". */
  badgeLabel?: string;
  disabled?: boolean;
  /** Route this destination opens. When set the item renders as a link, so it can open in a new tab. */
  href?: string;
  subItems?: PrismNavSubItem[];
}

export interface PrismNavSubItem {
  id: string;
  label: string;
  badge?: string | number;
  disabled?: boolean;
  href?: string;
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
  disabled?: boolean;
  onSelect?: () => void;
}

/** A labelled section of the Ctrl K palette. `whenSearching` groups only appear once the person has typed. */
export interface PrismCommandGroup {
  heading: string;
  actions: PrismPageAction[];
  whenSearching?: boolean;
}

/** The tab bar's raised centre action: the one thing a phone user must always reach in one tap. */
export interface PrismMobileTabAction {
  label: string;
  /** Spoken name when the visible label is short, such as "Report an issue" for "Report". */
  ariaLabel?: string;
  icon: LucideIcon;
  onSelect: () => void;
}

/** A phone tab: a sidebar item named by its id, or an item of its own when the tab differs from the sidebar row. */
export type PrismMobileTab = string | PrismNavItem;

type UpToThreeTabs = readonly [PrismMobileTab] | readonly [PrismMobileTab, PrismMobileTab] | readonly [PrismMobileTab, PrismMobileTab, PrismMobileTab];
type UpToFourTabs = UpToThreeTabs | readonly [PrismMobileTab, PrismMobileTab, PrismMobileTab, PrismMobileTab];

/**
 * The phone tab bar. It holds five slots: up to four tabs, or three around a raised action, with More last. More
 * collects every sidebar item that is not a tab or a top-bar icon, so no page is out of reach on a phone.
 */
export type PrismMobileBar = {
  /** Sidebar ids shown as icons in the phone top bar, such as messages and notifications. They stay out of More. */
  header?: readonly [string] | readonly [string, string];
} & ({ tabs: UpToFourTabs; action?: never } | { tabs: UpToThreeTabs; action: PrismMobileTabAction });

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
  /** Which portal this shell frames; sets the portal identity in the frame. */
  portal: "client" | "supplier" | "guest" | "event";
  productLabel?: string;
  roleLabel: string;
  title: string;
  description?: string;
  /** The sidebar item that owns the page. Omit it when no sidebar item does; nothing is highlighted then. */
  activeItemId?: string;
  /** Breadcrumb labels after the role. Defaults to the trail of the active sidebar item. */
  breadcrumb?: string[];
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
  /** Extra palette sections, such as records found by name. Rendered after the page navigation. */
  commandGroups?: PrismCommandGroup[];
  /** Shown when nothing in the palette matches the typed text. */
  commandEmptyLabel?: string;
  /** True while the records behind commandGroups are still loading; the palette shows a loading row for them. */
  commandGroupsLoading?: boolean;
  /** Called each time the palette opens, so a page can load its palette records on demand. */
  onCommandPaletteOpen?: () => void;
  headerActions?: React.ReactNode;
  /** Keep headerActions in the top bar on small screens too. Off by default, so they stay out of the way on mobile. */
  alwaysShowHeaderActions?: boolean;
  /** Sits under the brand in the sidebar, for a scope control such as the open event. Hidden when collapsed. */
  sidebarContext?: React.ReactNode;
  accountMenuItems?: PrismAccountMenuItem[];
  rightRail?: React.ReactNode;
  /**
   * The bottom tab bar on a phone. When set, phones get these tabs instead of the menu button, the account menu moves
   * to the top bar, and the page title shows once, in the top bar. Tablets and desktop keep the sidebar.
   */
  mobileBar?: PrismMobileBar;
  /** Stands in for the page name in the phone top bar, such as a switch for the open event. Only with `mobileBar`. */
  mobileTitle?: React.ReactNode;
  /** Extra controls in the phone top bar, before its icons and the account menu, such as a refresh. Only with `mobileBar`. */
  mobileHeaderActions?: React.ReactNode;
  sidebarMode?: "auto" | "single";
  sidebarContent?: React.ReactNode | ((props: PrismSidebarRenderProps) => React.ReactNode);
  onSignOut?: () => void;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  /** Padding for the page title when contentClassName removes the content padding. */
  titleClassName?: string;
  homeHref?: string;
}
