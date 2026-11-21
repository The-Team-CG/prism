"use client";

import { Alert, AlertDescription } from "@prism/ui/components/alert";
import { PrismDashboardShell } from "@prism/ui";
import { DashboardSkeleton } from "../dashboard-tabs";
import {
  CLIENT_EVENT_MOBILE_BAR,
  CLIENT_PORTAL_MOBILE_BAR,
  CLIENT_SIDEBAR_ITEMS,
  clientEventSidebarItems,
  EVENT_ROUTE_TO_NAV_ITEM,
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
  const isEventScopedView = isEventScopedClientRoute(route, eventId);
  // An event still loading already shows its own pages and phone bar, so nothing swaps once it arrives.
  const eventItems = isEventScopedView && eventId ? clientEventSidebarItems(eventId) : null;
  const navItems = eventItems ?? CLIENT_SIDEBAR_ITEMS.map((item) => ({
    ...item,
    disabled: item.requiresEvent,
    subItems: item.subItems?.map((subItem) => ({
      ...subItem,
      disabled: subItem.requiresEvent,
    })),
  }));
  const activeItemId = eventItems ? EVENT_ROUTE_TO_NAV_ITEM[route] ?? "event-overview" : sidebarActiveItemId(route, isEventScopedView, portalView);
  const copy = clientLoadingShellCopy({ portalView, route });

  function handleNavSelect(id: string) {
    const eventItem = eventItems?.find((entry) => entry.id === id);
    if (eventItem?.href) return onNavSelect(eventItem.href);
    const item = findClientSidebarLink(id);
    if (!item || item.requiresEvent) return;
    onNavSelect(dashboardHref(item.route, undefined, portalViewFromLink(item)));
  }

  return (
    <PrismDashboardShell
      portal="client"
      productLabel="P.R.I.S.M"
      roleLabel="Client Portal"
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
      mobileBar={eventItems ? CLIENT_EVENT_MOBILE_BAR : CLIENT_PORTAL_MOBILE_BAR}
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
