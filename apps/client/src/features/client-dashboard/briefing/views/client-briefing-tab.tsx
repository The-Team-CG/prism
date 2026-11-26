"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { BRIEFING_VENUE_TYPES, type BriefingVenueType, type PrismBriefing, type SubmitBriefingInput } from "@prism/types";
import { formatPortalDate } from "@prism/ui/format-date";
import { DatePicker } from "@prism/ui/components/date-picker";
import { TimePicker } from "@prism/ui/components/time-picker";
import { Button } from "@prism/ui/components/button";
import { Field, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Textarea } from "@prism/ui/components/textarea";
import { PrismPageColumn, PrismSection } from "@prism/ui/page-blocks";
import { money } from "../../shared/tab-ui";
import { ClientWalkInPolicyCard } from "./client-walk-in-policy-card";
import { ClientOwnSuppliers } from "@/features/client-dashboard/own-suppliers/views/client-own-suppliers";

type BriefingValues = {
  venue: string;
  venueType: string;
  guestCount: string;
  budgetRange: string;
  serviceRequirements: string;
  notes: string;
  confirmedDate: string;
  confirmedStartTime: string;
  confirmedEndTime: string;
  moodAndStyling: string;
  stylingBudget: string;
};

function valuesFrom(briefing?: PrismBriefing): BriefingValues {
  return {
    venue: briefing?.venue ?? "",
    venueType: briefing?.venueType ?? "",
    guestCount: briefing?.guestCount ? String(briefing.guestCount) : "",
    budgetRange: briefing?.budgetRange ?? "",
    serviceRequirements: briefing?.serviceRequirements.join("\n") ?? "",
    notes: briefing?.notes ?? "",
    confirmedDate: briefing?.confirmedDate?.slice(0, 10) ?? "",
    confirmedStartTime: briefing?.confirmedStartTime ?? "",
    confirmedEndTime: briefing?.confirmedEndTime ?? "",
    moodAndStyling: briefing?.moodAndStyling ?? "",
    stylingBudget: briefing?.stylingBudget == null ? "" : String(briefing.stylingBudget),
  };
}

function inputFrom(values: BriefingValues): SubmitBriefingInput {
  return {
    venue: values.venue,
    guestCount: Number(values.guestCount),
    budgetRange: values.budgetRange,
    serviceRequirements: values.serviceRequirements.split("\n").map((item) => item.trim()).filter(Boolean),
    notes: values.notes,
    confirmedDate: values.confirmedDate || undefined,
    confirmedStartTime: values.confirmedStartTime || undefined,
    confirmedEndTime: values.confirmedEndTime || undefined,
    moodAndStyling: values.moodAndStyling || undefined,
    venueType: values.venueType ? (values.venueType as BriefingVenueType) : undefined,
    stylingBudget: values.stylingBudget ? Number(values.stylingBudget) : undefined,
  };
}

/**
 * The event briefing: what PMCM is working from, read first, with an Edit mode that opens the form in place. Before
 * the first briefing there is nothing to read, so the form is the page. Walk-in guests and the client's own suppliers
 * follow as their own sections.
 */
export function ClientBriefingTab({
  eventId,
  briefing,
  busy,
  onSubmit,
  ownSuppliersEnabled = true,
}: {
  /** FR-24: PMCM can switch client-owned suppliers off for the event. */
  ownSuppliersEnabled?: boolean;
  eventId: string;
  briefing?: PrismBriefing;
  busy: boolean;
  onSubmit: (eventId: string, input: SubmitBriefingInput) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(() => valuesFrom(briefing));
  // A newly saved briefing (or another event's) resets the form and returns the page to reading. A refresh that
  // brings back the same version leaves an open form alone.
  const version = `${eventId}:${briefing?.submittedAt ?? "none"}`;
  useEffect(() => {
    setValues(valuesFrom(briefing));
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` names the briefing the form was filled from.
  }, [version]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(eventId, inputFrom(values));
  }

  return (
    <PrismPageColumn>
      {briefing && !editing ? (
        <BriefingOnFile briefing={briefing} onEdit={() => setEditing(true)} />
      ) : (
        <BriefingForm
          briefing={briefing}
          busy={busy}
          values={values}
          onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
          onSubmit={handleSubmit}
          onCancel={briefing ? () => { setValues(valuesFrom(briefing)); setEditing(false); } : undefined}
        />
      )}
      <ClientWalkInPolicyCard eventId={eventId} />
      {ownSuppliersEnabled ? <ClientOwnSuppliers eventId={eventId} /> : null}
    </PrismPageColumn>
  );
}

function Fact({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

const timeRange = (briefing: PrismBriefing) =>
  briefing.confirmedStartTime ? `${briefing.confirmedStartTime}${briefing.confirmedEndTime ? ` – ${briefing.confirmedEndTime}` : ""}` : null;

function BriefingOnFile({ briefing, onEdit }: { briefing: PrismBriefing; onEdit: () => void }) {
  const time = timeRange(briefing);
  return (
    <PrismSection
      id="client-briefing"
      title="Your briefing"
      description={`Sent ${formatPortalDate(briefing.submittedAt)}. PMCM plans and prices your event from these details.`}
      headerOutside
      action={<Button type="button" variant="outline" onClick={onEdit}>Edit briefing</Button>}
    >
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Fact label="Venue">{briefing.venue}{briefing.venueType ? <span className="text-muted-foreground"> · {briefing.venueType}</span> : null}</Fact>
        <Fact label="Guests">{briefing.guestCount}</Fact>
        <Fact label="Budget range">{briefing.budgetRange}</Fact>
        <Fact label="Styling budget">{briefing.stylingBudget == null ? "Not set" : money.format(briefing.stylingBudget)}</Fact>
        <Fact label="Date">{briefing.confirmedDate ? formatPortalDate(briefing.confirmedDate) : "Not confirmed yet"}</Fact>
        <Fact label="Program time">{time ?? "Not confirmed yet"}</Fact>
        <Fact label="Services you need" wide>
          {briefing.serviceRequirements.length ? briefing.serviceRequirements.join(" · ") : "None listed"}
        </Fact>
        {briefing.moodAndStyling ? <Fact label="Event theme" wide>{briefing.moodAndStyling}</Fact> : null}
        {briefing.notes ? <Fact label="Notes for PMCM" wide>{briefing.notes}</Fact> : null}
      </dl>
    </PrismSection>
  );
}

/** Radix selects cannot hold an empty value, so "no venue type yet" is this sentinel in the list. */
const NOT_DECIDED = "not-decided";

function BriefingForm({ briefing, busy, values, onChange, onSubmit, onCancel }: {
  briefing?: PrismBriefing;
  busy: boolean;
  values: BriefingValues;
  onChange: (patch: Partial<BriefingValues>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
}) {
  return (
    <PrismSection
      id="client-briefing"
      title={briefing ? "Edit your briefing" : "Your briefing"}
      description={briefing ? "Your changes go to PMCM as a new version; the earlier one stays in the event history." : "Tell PMCM about your event so they can prepare your proposal."}
      headerOutside
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          <BriefingField label="Venue preferences" required value={values.venue} onChange={(venue) => onChange({ venue })} />
          <Field>
            <FieldLabel htmlFor="briefing-venue-type">Venue type</FieldLabel>
            <Select value={values.venueType || NOT_DECIDED} onValueChange={(value) => onChange({ venueType: value === NOT_DECIDED ? "" : value })}>
              <SelectTrigger id="briefing-venue-type" className="w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NOT_DECIDED}>Not decided yet</SelectItem>
                {BRIEFING_VENUE_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <BriefingField label="Expected guest count" required type="number" min={1} value={values.guestCount} onChange={(guestCount) => onChange({ guestCount })} />
          <BriefingField label="Budget range" required value={values.budgetRange} onChange={(budgetRange) => onChange({ budgetRange })} />
          <Field>
            <FieldLabel htmlFor="confirmed-date">Confirmed date</FieldLabel>
            <DatePicker id="confirmed-date" aria-label="Confirmed date" value={values.confirmedDate} onValueChange={(confirmedDate) => onChange({ confirmedDate })} />
          </Field>
          <BriefingField label="Styling budget" type="number" min={0} value={values.stylingBudget} onChange={(stylingBudget) => onChange({ stylingBudget })} />
          <Field>
            <FieldLabel htmlFor="confirmed-start-time">Program start time</FieldLabel>
            <TimePicker id="confirmed-start-time" aria-label="Program start time" value={values.confirmedStartTime} onValueChange={(confirmedStartTime) => onChange({ confirmedStartTime })} scrollTo="18:00" />
          </Field>
          <Field>
            <FieldLabel htmlFor="confirmed-end-time">Program end time</FieldLabel>
            <TimePicker id="confirmed-end-time" aria-label="Program end time" value={values.confirmedEndTime} onValueChange={(confirmedEndTime) => onChange({ confirmedEndTime })} min={values.confirmedStartTime || undefined} scrollTo={values.confirmedStartTime || "22:00"} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="briefing-service-requirements">Services you need *</FieldLabel>
          <Textarea id="briefing-service-requirements" required value={values.serviceRequirements} onChange={(event) => onChange({ serviceRequirements: event.target.value })} placeholder="One per line, such as catering or lights and sound" />
        </Field>
        <Field>
          <FieldLabel htmlFor="briefing-mood">Event theme</FieldLabel>
          <Textarea id="briefing-mood" value={values.moodAndStyling} onChange={(event) => onChange({ moodAndStyling: event.target.value })} placeholder="The theme, look or atmosphere you have in mind" />
        </Field>
        <Field>
          <FieldLabel htmlFor="briefing-notes">Notes for PMCM *</FieldLabel>
          <Textarea id="briefing-notes" required value={values.notes} onChange={(event) => onChange({ notes: event.target.value })} placeholder="Constraints, priorities, or questions for your event team" />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          {onCancel ? <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button> : null}
          <Button type="submit" disabled={busy}>{busy ? "Sending…" : briefing ? "Send updated briefing" : "Send briefing"}</Button>
        </div>
      </form>
    </PrismSection>
  );
}

function BriefingField({
  label,
  value,
  onChange,
  required,
  type = "text",
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  min?: number;
}) {
  const id = `briefing-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}{required ? " *" : ""}</FieldLabel>
      <Input id={id} required={required} type={type} min={min} value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}
