"use client";

import { useEffect, useState } from "react";
import {
  Settings,
} from "lucide-react";
import { humanizeToken } from "@/features/pmcm-kit/model/formatters";
import type { EventSession } from "@/app/lib/session";
import type { PrismEvent } from "@prism/types";
import { Card, CardBody, CardHeader } from "./shell-ui";
import { isPmcmAdmin } from "@/app/lib/role-guards";


type EventSettingsWorkspaceProps = {
  session: EventSession;
  selectedEvent?: PrismEvent;
  onToggleClientEventDayView: (enabled: boolean) => Promise<boolean>;
};

export function EventSettingsWorkspace({
  session,
  selectedEvent,
  onToggleClientEventDayView,
}: EventSettingsWorkspaceProps) {
  const [clientEventDayViewEnabled, setClientEventDayViewEnabled] = useState(
    selectedEvent?.clientEventDayViewEnabled === true,
  );
  const [savingClientEventDayView, setSavingClientEventDayView] = useState(false);
  const [clientEventDayViewSaveFailed, setClientEventDayViewSaveFailed] = useState(false);
  const canManageClientEventDayView = isPmcmAdmin(session.role) && Boolean(selectedEvent);

  useEffect(() => {
    setClientEventDayViewEnabled(selectedEvent?.clientEventDayViewEnabled === true);
    setClientEventDayViewSaveFailed(false);
  }, [selectedEvent?.id, selectedEvent?.clientEventDayViewEnabled]);

  async function toggleClientEventDayView() {
    if (!canManageClientEventDayView || savingClientEventDayView) return;

    const nextEnabled = !clientEventDayViewEnabled;
    setSavingClientEventDayView(true);
    setClientEventDayViewSaveFailed(false);
    try {
      const saved = await onToggleClientEventDayView(nextEnabled);
      if (saved) setClientEventDayViewEnabled(nextEnabled);
      else setClientEventDayViewSaveFailed(true);
    } catch {
      setClientEventDayViewSaveFailed(true);
    } finally {
      setSavingClientEventDayView(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {[
        { label: "Signed in as", value: session.name, detail: humanizeToken(session.role) },
        { label: "Default workspace", value: selectedEvent?.eventName ?? "No event selected", detail: selectedEvent?.clientName ?? "Pick an event from Events." },
        { label: "Notifications", value: "Email + Viber", detail: "Production adapters are still gated by notification infrastructure." },
      ].map((item) => (
        <Card key={item.label}>
          <CardBody>
            <p className="text-3xs font-black uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-lg font-black text-foreground">{item.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
          </CardBody>
        </Card>
      ))}
      <Card className="lg:col-span-3">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="size-4 text-primary" />
            <h2 className="text-sm font-black text-foreground">Workspace controls</h2>
          </div>
        </CardHeader>
        <CardBody className="grid gap-3 md:grid-cols-3">
          {["Role-safe access", "Audit logging", "Client portal gating"].map((item) => (
            <div key={item} className="rounded-md border border-border bg-muted/20 px-4 py-3">
              <p className="text-sm font-black text-foreground">{item}</p>
              <p className="mt-1 text-xs text-muted-foreground">Managed by PMCM event command policy.</p>
            </div>
          ))}
          {canManageClientEventDayView && (
            <div className="rounded-md border border-border bg-muted/20 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p id="client-event-day-view-label" className="text-sm font-black text-foreground">
                    Client event-day view
                  </p>
                  <p id="client-event-day-view-description" className="mt-1 text-xs text-muted-foreground">
                    Show a general event-day status on the client timeline.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={clientEventDayViewEnabled}
                  aria-label="Client event-day view"
                  aria-describedby="client-event-day-view-description"
                  data-checked={clientEventDayViewEnabled ? "true" : "false"}
                  disabled={savingClientEventDayView}
                  onClick={() => void toggleClientEventDayView()}
                  className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[checked=true]:border-primary data-[checked=true]:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span
                    aria-hidden="true"
                    className="size-4 translate-x-1 rounded-full bg-background shadow-sm transition-transform data-[checked=true]:translate-x-6"
                    data-checked={clientEventDayViewEnabled ? "true" : "false"}
                  />
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
                {savingClientEventDayView
                  ? "Saving…"
                  : clientEventDayViewEnabled
                    ? "Visible to the client"
                    : "Hidden from the client"}
              </p>
              {clientEventDayViewSaveFailed && (
                <p role="alert" className="mt-2 text-xs text-destructive">
                  Could not save the client event-day view. Try again.
                </p>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

