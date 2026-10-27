"use client";

import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { PrismDashboardShell } from "@prism/ui";
import { DashboardSkeleton } from "../dashboard-tabs";
import {
  CLIENT_SIDEBAR_ITEMS,
  dashboardHref,
  dashboardLoadingVariant,
  findClientSidebarLink,
  portalViewFromLink,
  sidebarActiveItemId,
} from "../../model/client-dashboard-navigation";
import { clientLoadingShellCopy, isEventScopedClientRoute } from "../../model/client-dashboard-shell-copy";
import type { ClientDashboardRoute, ClientPortalView, ClientSession } from "../../model/client-dashboard-types";

export function ClientDashboardLoadingShell({
  route,
  eventId,
  portalView,
  session,
  error,
  onNavSelect,
  onSignOut,
}: {
  route: ClientDashboardRoute;
  eventId?: string;
  portalView?: ClientPortalView;
  session: ClientSession;
  error: string | null;
  onNavSelect: (href: string) => void;
  onSignOut: () => void;
}) {
  const navItems = CLIENT_SIDEBAR_ITEMS.map((item) => ({
    ...item,
    disabled: item.requiresEvent,
    subItems: item.subItems?.map((subItem) => ({
      ...subItem,
      disabled: subItem.requiresEvent,
    })),
  }));
  const isEventScopedView = isEventScopedClientRoute(route, eventId);
  const activeItemId = sidebarActiveItemId(route, isEventScopedView, portalView);
  const copy = clientLoadingShellCopy({ portalView, route });

  function handleNavSelect(id: string) {
    const item = findClientSidebarLink(id);
    if (!item || item.requiresEvent) return;
    onNavSelect(dashboardHref(item.route, undefined, portalViewFromLink(item)));
  }

  return (
    <PrismDashboardShell
      portal="client"
      productLabel="P.R.I.S.M"
      roleLabel="Client Portal"
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      activeItemId={activeItemId}
      navItems={navItems}
      onNavSelect={handleNavSelect}
      user={{
        name: session.name,
        detail: session.organization,
        initials: session.name.slice(0, 2).toUpperCase(),
      }}
      searchPlaceholder="Search proposal, billing, documents..."
      mobileActions={[]}
      onSignOut={onSignOut}
    >
      {error ? (
        <Alert variant="destructive" className="rounded-lg">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <DashboardSkeleton variant={dashboardLoadingVariant(route)} />
      )}
    </PrismDashboardShell>
  );
}
