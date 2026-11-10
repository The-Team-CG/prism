"use client";

import { Send } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Card, CardContent } from "@prism/ui/components/card";
import { Checkbox } from "@prism/ui/components/checkbox";
import { DatePicker } from "@prism/ui/components/date-picker";
import { Field, FieldDescription, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Textarea } from "@prism/ui/components/textarea";
import { useClientWorkspace } from "../../workspace/shared";

/**
 * The request form. The page title and description come from the portal shell, so the form does not repeat them.
 * The submit button explains itself while it is disabled.
 */
export function ClientRequestView() {
  const { session, requestForm, setRequestForm, submitNewEventRequest, busy } = useClientWorkspace();
  const submitting = busy === "event-request";
  const consentMissing = !requestForm.privacyConsentAccepted;

  return (
    <div className="max-w-2xl">
      <Card>
        <CardContent className="py-6">
          <form className="space-y-5" onSubmit={submitNewEventRequest}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="client-request-name">Client name</FieldLabel>
                <Input id="client-request-name" value={session.name} readOnly className="bg-muted/40" />
              </Field>
              <Field>
                <FieldLabel htmlFor="client-request-company">Company</FieldLabel>
                <Input id="client-request-company" value={session.organization} readOnly className="bg-muted/40" />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="client-request-event-name">Event name</FieldLabel>
              <Input
                id="client-request-event-name"
                required
                value={requestForm.eventName}
                onChange={(ev) => setRequestForm({ ...requestForm, eventName: ev.target.value })}
                placeholder="e.g. Leadership Summit 2026"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Event date</FieldLabel>
                <DatePicker
                  required
                  value={requestForm.eventDate}
                  onValueChange={(value) => setRequestForm({ ...requestForm, eventDate: value })}
                  aria-label="Event date"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="client-request-event-type">Event type</FieldLabel>
                <Input
                  id="client-request-event-type"
                  value={requestForm.eventType}
                  onChange={(ev) => setRequestForm({ ...requestForm, eventType: ev.target.value })}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="client-request-venue">Venue or city</FieldLabel>
                <Input
                  id="client-request-venue"
                  value={requestForm.venueCity}
                  onChange={(ev) => setRequestForm({ ...requestForm, venueCity: ev.target.value })}
                  placeholder="Venue, city, or TBD"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="client-request-budget">Budget range</FieldLabel>
                <Input
                  id="client-request-budget"
                  value={requestForm.budgetRange}
                  onChange={(ev) => setRequestForm({ ...requestForm, budgetRange: ev.target.value })}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="client-request-notes">Planning notes</FieldLabel>
              <Textarea
                id="client-request-notes"
                required
                value={requestForm.message}
                onChange={(ev) => setRequestForm({ ...requestForm, message: ev.target.value })}
                rows={5}
                placeholder="Share goals, estimated guests, event format, program notes, or early constraints."
              />
            </Field>

            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-semibold text-foreground">What happens next</p>
              <ol className="mt-2 space-y-1 text-muted-foreground">
                <li>1. PMCM reviews fit and scope.</li>
                <li>2. PMCM accepts, pends, or declines.</li>
                <li>3. Signed conforme unlocks the event workspace.</li>
              </ol>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="client-request-consent"
                required
                checked={requestForm.privacyConsentAccepted}
                onCheckedChange={(checked) => setRequestForm({ ...requestForm, privacyConsentAccepted: checked === true })}
                className="mt-0.5"
              />
              <FieldLabel htmlFor="client-request-consent" className="font-normal leading-5 text-muted-foreground">
                I consent to PMCM processing this request to review and plan the event.
              </FieldLabel>
            </div>

            <Field>
              <Button type="submit" disabled={submitting || consentMissing} className="self-start font-semibold">
                Submit request <Send aria-hidden />
              </Button>
              {consentMissing ? <FieldDescription>Accept the privacy consent above to submit this request.</FieldDescription> : null}
            </Field>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
