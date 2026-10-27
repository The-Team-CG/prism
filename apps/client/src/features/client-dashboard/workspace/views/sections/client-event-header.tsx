"use client";

import { Home, MapPinned, WalletCards } from "lucide-react";
import { NoticeBanner } from "./shell-presentational";
import { clientEventWorkspaceAvailable } from "../../model/client-dashboard-navigation";
import type { ClientDashboardRoute } from "../../model/client-dashboard-types";
import type { PrismEvent } from "@prism/types";

export function ClientWorkspaceBanners({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error ? <NoticeBanner tone="danger">{error}</NoticeBanner> : null}
      {notice ? <NoticeBanner tone="success">{notice}</NoticeBanner> : null}
    </>
  );
}

export function clientShellMobileActions(
  route: ClientDashboardRoute,
  selectedEvent: PrismEvent | undefined,
  onHome: () => void,
  onNavigate: (next: ClientDashboardRoute) => void,
) {
  const hasActiveEvent = clientEventWorkspaceAvailable(selectedEvent);
  return [
    { id: "home", label: "Home", icon: Home, active: route === "home", onSelect: onHome },
    { id: "overview", label: "Overview", icon: Home, active: route === "overview", disabled: !hasActiveEvent, onSelect: () => onNavigate("overview") },
    { id: "floorplan", label: "Plan", icon: MapPinned, active: route === "floorplan", disabled: !hasActiveEvent, onSelect: () => onNavigate("floorplan") },
    { id: "billing", label: "Pay", icon: WalletCards, active: route === "billing", disabled: !hasActiveEvent, onSelect: () => onNavigate("billing") },
  ];
}
