"use client";

import { useEffect, useState } from "react";
import {
  Settings,
} from "lucide-react";
import { humanizeToken } from "@/features/pmcm-kit/model/formatters";
import type { EventSession } from "@/app/lib/session";
import type { PrismEvent, PrismNotificationPreferences } from "@prism/types";
import { notificationChannelSummary } from "@/features/account-notifications/model/notification-channel-summary";
import { notificationPreferencesRepository } from "@/features/account-notifications/data/notification-preferences-repository";
import { Card, CardBody, CardHeader } from "./shell-ui";
import { isPmcmAdmin } from "@/app/lib/role-guards";

function EventPrivacyControl({ selectedEvent, onSetEventPrivacy }: {
  selectedEvent?: PrismEvent;
  onSetEventPrivacy: (privacy: "private" | "public") => Promise<boolean>;
}) {
  const [privacy, setPrivacy] = useState<"private" | "public">(selectedEvent?.privacy ?? "private");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setPrivacy(selectedEvent?.privacy ?? "private");
    setFailed(false);
  }, [selectedEvent?.id, selectedEvent?.privacy]);
  if (!selectedEvent || selectedEvent.archived) return null;

  async function choose(next: "private" | "public") {
    if (saving || next === privacy) return;
    setSaving(true);
    setFailed(false);
    try {
      if (await onSetEventPrivacy(next)) setPrivacy(next);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <fieldset className="rounded-md border border-border bg-muted/20 px-4 py-3" disabled={saving}>
      <legend className="sr-only">Event privacy</legend>
      <p className="text-sm font-black text-foreground">Event privacy</p>
      <p id="event-privacy-description" className="mt-1 text-xs text-muted-foreground">
        Private events under 200 guests can use table assignment and the seating list.
      </p>
      <div className="mt-3 flex gap-4 text-sm" aria-describedby="event-privacy-description">
        {(["private", "public"] as const).map((option) => (
          <label key={option} className="flex items-center gap-2">
            <input type="radio" name="event-privacy" value={option} checked={privacy === option} onChange={() => void choose(option)} />
            {option === "private" ? "Private" : "Public"}
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">{saving ? "Saving…" : null}</p>
      {failed ? <p role="alert" className="mt-2 text-xs text-destructive">Could not save the event privacy. Try again.</p> : null}
    </fieldset>
  );
}


type EventSettingsWorkspaceProps = {
  session: EventSession;
  selectedEvent?: PrismEvent;
  onToggleClientEventDayView: (enabled: boolean) => Promise<boolean>;
  onSetEventPrivacy: (privacy: "private" | "public") => Promise<boolean>;
};

export function EventSettingsWorkspace({
  session,
  selectedEvent,
  onToggleClientEventDayView,
  onSetEventPrivacy,
}: EventSettingsWorkspaceProps) {
  const [clientEventDayViewEnabled, setClientEventDayViewEnabled] = useState(
    selectedEvent?.clientEventDayViewEnabled === true,
  );
  const [savingClientEventDayView, setSavingClientEventDayView] = useState(false);
  const [clientEventDayViewSaveFailed, setClientEventDayViewSaveFailed] = useState(false);
  const canManageClientEventDayView = isPmcmAdmin(session.role) && Boolean(selectedEvent);
  const [notificationPreferences, setNotificationPreferences] = useState<PrismNotificationPreferences | null>(null);

  useEffect(() => {
    let alive = true;
    // The summary only describes what the account's own settings say; if they cannot be read it keeps to the email claim.
    notificationPreferencesRepository.mine().then((next) => { if (alive) setNotificationPreferences(next); }, () => undefined);
    return () => { alive = false; };
  }, []);

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
        { label: "Notifications", ...notificationChannelSummary(notificationPreferences, session.email) },
      ].map((item) => (
        <Card key={item.label}>
          <CardBody>
            <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-lg font-black text-foreground">{item.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
          </CardBody>
        </Card>
      ))}
      {canManageClientEventDayView ? (
      <Card className="lg:col-span-3">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="size-4 text-primary" />
            <h2 className="text-sm font-black text-foreground">Workspace controls</h2>
          </div>
        </CardHeader>
        <CardBody className="grid gap-3 md:grid-cols-3">
          <EventPrivacyControl selectedEvent={selectedEvent} onSetEventPrivacy={onSetEventPrivacy} />
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
      ) : null}
    </div>
  );
}

