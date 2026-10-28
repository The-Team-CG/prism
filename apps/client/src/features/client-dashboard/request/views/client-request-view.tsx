"use client";

import { Send } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { DatePicker } from "@prism/ui/components/date-picker";
import { FieldGroup } from "../../workspace/shared";
import { CLIENT_PORTAL_VIEW_META } from "../../workspace/shared";
import { useClientWorkspace } from "../../workspace/shared";

export function ClientRequestView() {
  const {
    portalView,
    session,
    requestForm,
    setRequestForm,
    submitNewEventRequest,
    busy,
  } = useClientWorkspace();
  const portalViewMeta = portalView ? CLIENT_PORTAL_VIEW_META[portalView] : undefined;

  return (
  <div className="mx-auto max-w-2xl space-y-6">
    <div>
      <h1 className="text-2xl font-black text-foreground">{portalViewMeta?.title ?? "New event request"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {portalViewMeta?.description ?? "Tell PMCM about your next event. Your account details are pre-filled. PMCM reviews all requests before activating the workspace."}
      </p>
    </div>

    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <form className="space-y-5 p-6" onSubmit={submitNewEventRequest}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup label="Client name">
            <Input value={session.name} readOnly className="rounded-lg bg-muted/40" />
          </FieldGroup>
          <FieldGroup label="Company">
            <Input value={session.organization} readOnly className="rounded-lg bg-muted/40" />
          </FieldGroup>
        </div>
        <FieldGroup label="Event name">
          <Input
            required
            value={requestForm.eventName}
            onChange={(ev) => setRequestForm({ ...requestForm, eventName: ev.target.value })}
            placeholder="e.g. Leadership Summit 2026"
            className="rounded-lg"
          />
        </FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup label="Event date">
            <DatePicker
              required
              value={requestForm.eventDate}
              onValueChange={(value) => setRequestForm({ ...requestForm, eventDate: value })}
              aria-label="Event date"
              className="rounded-lg"
            />
          </FieldGroup>
          <FieldGroup label="Event type">
            <Input
              value={requestForm.eventType}
              onChange={(ev) => setRequestForm({ ...requestForm, eventType: ev.target.value })}
              className="rounded-lg"
            />
          </FieldGroup>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup label="Venue or city">
            <Input
              value={requestForm.venueCity}
              onChange={(ev) => setRequestForm({ ...requestForm, venueCity: ev.target.value })}
              placeholder="Venue, city, or TBD"
              className="rounded-lg"
            />
          </FieldGroup>
          <FieldGroup label="Budget range">
            <Input
              value={requestForm.budgetRange}
              onChange={(ev) => setRequestForm({ ...requestForm, budgetRange: ev.target.value })}
              className="rounded-lg"
            />
          </FieldGroup>
        </div>
        <FieldGroup label="Planning notes">
          <textarea
            required
            value={requestForm.message}
            onChange={(ev) => setRequestForm({ ...requestForm, message: ev.target.value })}
            rows={5}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            placeholder="Share goals, estimated guests, event format, program notes, or early constraints."
          />
        </FieldGroup>

        <div className="rounded-xl border border-primary/15 bg-primary-soft p-4 text-sm">
          <p className="font-bold text-foreground">What happens next</p>
          <ol className="mt-2 space-y-1 text-muted-foreground">
            <li>1. PMCM reviews fit and scope.</li>
            <li>2. PMCM accepts, pends, or declines.</li>
            <li>3. Signed conforme unlocks the event workspace.</li>
          </ol>
        </div>

        <label className="flex items-start gap-3 text-sm leading-5 text-muted-foreground">
          <input
            type="checkbox"
            checked={requestForm.privacyConsentAccepted}
            onChange={(event) => setRequestForm({ ...requestForm, privacyConsentAccepted: event.target.checked })}
            required
            className="mt-0.5 size-4 accent-primary"
          />
          <span>I consent to PMCM processing this request to review and plan the event.</span>
        </label>

        <Button type="submit" disabled={busy === "event-request" || !requestForm.privacyConsentAccepted} className="w-full rounded-lg font-bold">
          Submit request <Send className="size-4" />
        </Button>
      </form>
    </div>
  </div>
  );
}
