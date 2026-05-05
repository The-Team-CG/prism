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
  return (
    <PrismAppShell {...props}>
      {props.children}
    </PrismAppShell>
  );
}
