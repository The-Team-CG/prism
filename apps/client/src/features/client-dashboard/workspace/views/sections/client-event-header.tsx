"use client";

import { Home, MapPinned, WalletCards } from "lucide-react";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { Button } from "@/app/components/ui/button";
import { EventWorkspaceNav, NoticeBanner } from "./shell-presentational";
import { EVENT_WORKSPACE_NAV_ITEMS } from "../../model/client-dashboard-navigation";
import { formatStatusLabel } from "../../model/client-dashboard-view-rules";
import type { ClientDashboardRoute, DetailTab } from "../../model/client-dashboard-types";
import type { PrismEvent } from "@prism/types";

export function ClientWorkspaceBanners({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error ? <NoticeBanner tone="danger">{error}</NoticeBanner> : null}
      {notice ? <NoticeBanner tone="success">{notice}</NoticeBanner> : null}
    </>
  );
}

export function ClientEventHeader({
  event,
  activeEventNavItemId,
  onSwitchEvent,
  onNavigate,
}: {
  event: PrismEvent;
  activeEventNavItemId: string;
  onSwitchEvent: () => void;
  onNavigate: (route: DetailTab | ClientDashboardRoute) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-muted/60 to-transparent px-5 py-4">
        <div className="min-w-0 flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--prism-signal)] text-white font-black text-base select-none">
            {event.eventName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-black leading-tight text-foreground truncate">{event.eventName}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span>{event.eventDate ?? "Date TBD"}</span>
              <span aria-hidden>·</span>
              <StatusBadge status={event.status} label={formatStatusLabel(event.status)} />
            </div>
          </div>
        </div>
        <Button size="sm" variant="ghost" className="rounded-lg text-xs font-semibold text-muted-foreground shrink-0" onClick={onSwitchEvent}>
          Switch event
        </Button>
      </div>
      <EventWorkspaceNav
        items={EVENT_WORKSPACE_NAV_ITEMS}
        activeItemId={activeEventNavItemId}
        onSelect={(item) => onNavigate(item.route)}
      />
    </section>
  );
}

export function clientShellMobileActions(
  route: ClientDashboardRoute,
  selectedEvent: PrismEvent | undefined,
  onHome: () => void,
  onNavigate: (next: ClientDashboardRoute) => void,
) {
  return [
    { id: "home", label: "Home", icon: Home, active: route === "home", onSelect: onHome },
    { id: "overview", label: "Overview", icon: Home, active: route === "overview", disabled: !selectedEvent, onSelect: () => onNavigate("overview") },
    { id: "floorplan", label: "Plan", icon: MapPinned, active: route === "floorplan", disabled: !selectedEvent, onSelect: () => onNavigate("floorplan") },
    { id: "billing", label: "Pay", icon: WalletCards, active: route === "billing", disabled: !selectedEvent, onSelect: () => onNavigate("billing") },
  ];
}
