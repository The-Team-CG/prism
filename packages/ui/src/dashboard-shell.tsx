"use client";

import type { PrismAppShellProps, PrismNavItem, PrismPageAction } from "./shell/types";
import { PrismPortalShell } from "./shell/portal-shell";

export type PrismShellNavItem = PrismNavItem;
export type PrismCommandAction = PrismPageAction;
export type PrismDashboardShellProps = PrismAppShellProps;

export function PrismDashboardShell(props: PrismDashboardShellProps) {
  return <PrismPortalShell {...props} />;
}
