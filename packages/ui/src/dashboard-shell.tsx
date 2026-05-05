"use client";

import {
  PrismAppShell,
  type PrismAppShellProps,
  type PrismNavItem,
  type PrismPageAction,
} from "./app-shell";

export type PrismShellNavItem = PrismNavItem;
export type PrismCommandAction = PrismPageAction;
export type PrismDashboardShellProps = PrismAppShellProps;

export function PrismDashboardShell(props: PrismDashboardShellProps) {
  const activeItem = props.navItems.find((item) => item.id === props.activeItemId);

  return (
    <PrismAppShell
      {...props}
      activeItemLabel={props.activeItemLabel ?? activeItem?.label}
    >
      {props.children}
    </PrismAppShell>
  );
}
