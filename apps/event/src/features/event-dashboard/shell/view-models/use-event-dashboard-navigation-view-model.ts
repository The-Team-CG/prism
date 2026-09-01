"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrismEvent } from "@prism/types";
import { clearEventSession, type EventSession } from "@/app/lib/session";
import type { EventClientRecord } from "../model/event-dashboard-selectors";
import {
  CLIENT_DETAIL_ROUTES,
  EVENT_DETAIL_ROUTES,
  EVENT_TAB_ROUTES,
  EVENT_WORKSPACE_ROUTE_TABS,
  SIDEBAR_STATIC_ROUTES,
  routeStateForSidebarItem,
  type DashboardSection,
  type DetailTab,
  type RouteState,
} from "../model/event-dashboard-routing";

const SECTION_ROUTES: Partial<Record<DashboardSection, string>> = {
  dashboard: "/dashboard",
  clients: "/dashboard/clients",
  calendar: "/dashboard/calendar",
  tasks: "/dashboard/tasks",
  "command-inbox": "/dashboard/command-inbox",
  team: "/dashboard/team",
  suppliers: "/dashboard/suppliers",
  files: "/dashboard/files",
  messages: "/dashboard/messages",
  finance: "/dashboard/finance",
  audit: "/dashboard/audit",
  settings: "/dashboard/settings",
  inquiries: "/dashboard/inquiries",
  "events-list": "/dashboard/events",
};

export function useEventDashboardNavigationViewModel({
  routeState,
  session,
  screenName,
  selectedEvent,
  selectedEventId,
  selectedClient,
  setSection,
  setTab,
  setSelectedEventId,
  setSelectedClientId,
}: {
  routeState: RouteState;
  session: EventSession | null;
  screenName: "portal" | "editor";
  selectedEvent?: PrismEvent;
  selectedEventId: string | null;
  selectedClient?: EventClientRecord | null;
  setSection: (section: DashboardSection) => void;
  setTab: (tab: DetailTab) => void;
  setSelectedEventId: (eventId: string | null) => void;
  setSelectedClientId: (clientId: string | null) => void;
}) {
  const router = useRouter();
  const [sidebarActiveOverride, setSidebarActiveOverride] = useState<string | null>(null);

  useEffect(() => {
    if (!session || screenName !== "portal") return;

    [
      "/dashboard",
      "/dashboard/inquiries",
      "/dashboard/events",
      "/dashboard/clients",
      "/dashboard/calendar",
      "/dashboard/tasks",
      "/dashboard/command-inbox",
      "/dashboard/team",
      "/dashboard/suppliers",
      "/dashboard/files",
      "/dashboard/messages",
      "/dashboard/finance",
      "/dashboard/audit",
      "/dashboard/settings",
    ].forEach((path) => router.prefetch(path));

    const eventId = routeState.eventId ?? selectedEvent?.id ?? selectedEventId;
    if (!eventId) return;

    Object.values(EVENT_TAB_ROUTES).forEach((route) => {
      router.prefetch(`/dashboard/events/${encodeURIComponent(eventId)}/${route}`);
    });
  }, [routeState.eventId, router, screenName, selectedEvent?.id, selectedEventId, session]);

  function eventRoute(eventId: string, nextTab: DetailTab = "overview") {
    return `/dashboard/events/${encodeURIComponent(eventId)}/${EVENT_TAB_ROUTES[nextTab]}`;
  }

  function navigateEvent(eventId: string, nextTab: DetailTab = "overview") {
    setSidebarActiveOverride(null);
    setSection("events");
    setSelectedEventId(eventId);
    setTab(nextTab);
    router.push(eventRoute(eventId, nextTab));
  }

  function navigateClient(clientId: string) {
    setSidebarActiveOverride(null);
    setSection("clients");
    setSelectedClientId(clientId);
    router.push(`/dashboard/clients/${encodeURIComponent(clientId)}`);
  }

  function navigateEventTab(nextTab: DetailTab, options: { preserveSidebarActive?: boolean } = {}) {
    if (!options.preserveSidebarActive) setSidebarActiveOverride(null);
    setSection("events");
    setTab(nextTab);
    const targetId = selectedEvent?.id ?? selectedEventId;
    router.push(targetId ? eventRoute(targetId, nextTab) : "/dashboard/events");
  }

  function navigateSection(nextSection: DashboardSection, options: { preserveSidebarActive?: boolean } = {}) {
    if (!options.preserveSidebarActive) setSidebarActiveOverride(null);
    setSection(nextSection);
    if (nextSection === "clients") setSelectedClientId(null);
    router.push(SECTION_ROUTES[nextSection] ?? "/dashboard");
  }

  function handleSidebarNav(id: string) {
    setSidebarActiveOverride(id);
    const staticRoute = SIDEBAR_STATIC_ROUTES[id];
    if (staticRoute) {
      const nextRouteState = routeStateForSidebarItem(id);
      if (nextRouteState) {
        setSection(nextRouteState.section);
        setTab(nextRouteState.tab);
        if (nextRouteState.section === "clients") setSelectedClientId(null);
      }
      router.push(staticRoute);
      return;
    }

    const clientRoute = CLIENT_DETAIL_ROUTES[id];
    if (clientRoute && selectedClient) {
      setSection("clients");
      setSelectedClientId(selectedClient.id);
      router.push(
        `/dashboard/clients/${encodeURIComponent(selectedClient.id)}${clientRoute === "overview" ? "" : `/${clientRoute}`}`,
      );
      return;
    }

    const eventRouteSegment = EVENT_DETAIL_ROUTES[id];
    if (eventRouteSegment) {
      const targetId = selectedEvent?.id ?? selectedEventId;
      if (!targetId) {
        navigateSection("events-list", { preserveSidebarActive: true });
        return;
      }
      setSection("events");
      setTab(EVENT_WORKSPACE_ROUTE_TABS[eventRouteSegment] ?? "overview");
      router.push(
        `/dashboard/events/${encodeURIComponent(targetId)}${eventRouteSegment === "overview" ? "/overview" : `/${eventRouteSegment}`}`,
      );
    }
  }

  function signOut() {
    clearEventSession();
    router.replace("/sign-in");
  }

  return {
    status: "ready" as const,
    router,
    sidebarActiveOverride,
    navigateEvent,
    navigateClient,
    navigateEventTab,
    navigateSection,
    handleSidebarNav,
    signOut,
  };
}
