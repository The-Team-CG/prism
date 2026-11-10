"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FileText,
  LockKeyhole,
  MapPinned,
  MessageSquareText,
  Presentation,
  ReceiptText,
  ThumbsUp,
  Timer,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { PrismAuditLog, PrismBillingStatement, PrismBriefing, PrismDocument, PrismEvent, PrismFloorPlanDraft, PrismPaymentMilestone } from "@prism/types";
import { DatePicker } from "@prism/ui/components/date-picker";
import { TimePicker } from "@prism/ui/components/time-picker";
import { Button } from "@prism/ui/components/button";
import { Field, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { Textarea } from "@prism/ui/components/textarea";
import { PrismPageColumn, PrismSection } from "@prism/ui/page-blocks";
import {
  DataRow,
  SectionLabel,
  actorInitials,
  clientActivityActor,
  clientActivityTitle,
  formatDayLabel,
  formatLabel,
  groupByDay,
  money,
  portalBadgeStatus,
  portalStatusLabel,
} from "../../shared/tab-ui";
import type { DetailTab } from "../../workspace/shared";
import { BRIEFING_VENUE_TYPES, type BriefingVenueType, type SubmitBriefingInput } from "@prism/types";
import { ClientWalkInPolicyCard } from "./client-walk-in-policy-card";
import { ClientOwnSuppliers } from "@/features/client-dashboard/own-suppliers/views/client-own-suppliers";


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
  const [venue, setVenue] = useState(briefing?.venue ?? "");
  const [venueType, setVenueType] = useState(briefing?.venueType ?? "");
  const [guestCount, setGuestCount] = useState(briefing?.guestCount ? String(briefing.guestCount) : "");
  const [budgetRange, setBudgetRange] = useState(briefing?.budgetRange ?? "");
  const [serviceRequirements, setServiceRequirements] = useState(briefing?.serviceRequirements.join("\n") ?? "");
  const [notes, setNotes] = useState(briefing?.notes ?? "");
  const [confirmedDate, setConfirmedDate] = useState("");
  const [confirmedStartTime, setConfirmedStartTime] = useState("");
  const [confirmedEndTime, setConfirmedEndTime] = useState("");
  const [moodAndStyling, setMoodAndStyling] = useState("");
  const [stylingBudget, setStylingBudget] = useState("");
  useEffect(() => {
    setVenue(briefing?.venue ?? "");
    setGuestCount(briefing?.guestCount ? String(briefing.guestCount) : "");
    setBudgetRange(briefing?.budgetRange ?? "");
    setServiceRequirements(briefing?.serviceRequirements.join("\n") ?? "");
    setNotes(briefing?.notes ?? "");
    setConfirmedDate(briefing?.confirmedDate?.slice(0, 10) ?? "");
    setConfirmedStartTime(briefing?.confirmedStartTime ?? "");
    setConfirmedEndTime(briefing?.confirmedEndTime ?? "");
    setMoodAndStyling(briefing?.moodAndStyling ?? "");
    setVenueType(briefing?.venueType ?? "");
    setStylingBudget(briefing?.stylingBudget == null ? "" : String(briefing.stylingBudget));
  }, [briefing]);
  const isComplete = Boolean(
    briefing?.venue && briefing?.guestCount && briefing?.serviceRequirements?.length,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(eventId, {
      venue,
      guestCount: Number(guestCount),
      budgetRange,
      serviceRequirements: serviceRequirements.split("\n").map((item) => item.trim()).filter(Boolean),
      notes,
      confirmedDate: confirmedDate || undefined,
      confirmedStartTime: confirmedStartTime || undefined,
      confirmedEndTime: confirmedEndTime || undefined,
      moodAndStyling: moodAndStyling || undefined,
      venueType: venueType ? (venueType as BriefingVenueType) : undefined,
      stylingBudget: stylingBudget ? Number(stylingBudget) : undefined,
    });
  }

  // The form is the client's task on this page, so it comes first; before a first submission there is
  // nothing on file to report, so the status and summary appear only once a briefing exists.
  return <PrismPageColumn>
    {briefing ? <BriefingStatus complete={isComplete} /> : null}
    {briefing ? <BriefingSummary briefing={briefing} /> : null}
    <BriefingSubmissionForm
      briefing={briefing} busy={busy} onSubmit={handleSubmit}
      values={{ venue, venueType, guestCount, budgetRange, serviceRequirements, notes, confirmedDate, confirmedStartTime, confirmedEndTime, moodAndStyling, stylingBudget }}
      setters={{ setVenue, setVenueType, setGuestCount, setBudgetRange, setServiceRequirements, setNotes, setConfirmedDate, setConfirmedStartTime, setConfirmedEndTime, setMoodAndStyling, setStylingBudget }}
    />
    <ClientWalkInPolicyCard eventId={eventId} />
    {ownSuppliersEnabled ? <ClientOwnSuppliers eventId={eventId} /> : null}
  </PrismPageColumn>;
}

function BriefingStatus({ complete }: { complete: boolean }) {
  return <div className={`rounded-lg border px-5 py-4 ${complete ? "border-success/25 bg-success/8" : "border-attention/25 bg-attention-soft"}`}>
    <p className={`text-sm font-semibold ${complete ? "text-success" : "text-attention"}`}>{complete ? "Briefing complete" : "Briefing in progress"}</p>
    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{complete ? "All core briefing details are on file." : "Your event team is still confirming the venue, guest count, and service requirements."}</p>
  </div>;
}

function BriefingSummary({ briefing }: { briefing: PrismBriefing }) {
  return <PrismSection id="client-briefing-summary" title="On file" description="The briefing details PMCM is working from.">
    <DataRow label="Venue" value={briefing.venue} />
    <DataRow label="Guest count" value={`${briefing.guestCount} guests`} />
    <DataRow label="Budget range" value={briefing.budgetRange} />
    <DataRow label="Service requirements" value={briefing.serviceRequirements.join(", ")} />
  </PrismSection>;
}

/** Radix selects cannot hold an empty value, so "no venue type yet" is this sentinel in the list. */
const NOT_DECIDED = "not-decided";

type BriefingValues = Record<string, string>;
type BriefingSetters = Record<string, (value: string) => void>;
function BriefingSubmissionForm({ briefing, busy, onSubmit, values, setters }: {
  briefing?: PrismBriefing;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  values: BriefingValues;
  setters: BriefingSetters;
}) {
  return <PrismSection id="client-briefing-form" title={briefing ? "Update your briefing" : "Your briefing"} description="Share your event requirements with PMCM. Each submission is kept in the event history.">
    <form onSubmit={onSubmit} className="space-y-4"><div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
      <BriefingField label="Venue preference" required value={values.venue} onChange={setters.setVenue} />
      <Field>
        <FieldLabel htmlFor="briefing-venue-type">Venue type</FieldLabel>
        <Select value={values.venueType || NOT_DECIDED} onValueChange={(value) => setters.setVenueType(value === NOT_DECIDED ? "" : value)}>
          <SelectTrigger id="briefing-venue-type" className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NOT_DECIDED}>Not decided yet</SelectItem>
            {BRIEFING_VENUE_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <BriefingField label="Expected guest count" required type="number" min={1} value={values.guestCount} onChange={setters.setGuestCount} />
      <BriefingField label="Budget range" required value={values.budgetRange} onChange={setters.setBudgetRange} />
      <Field>
        <FieldLabel htmlFor="confirmed-date">Confirmed date</FieldLabel>
        <DatePicker id="confirmed-date" aria-label="Confirmed date" value={values.confirmedDate} onValueChange={setters.setConfirmedDate} />
      </Field>
      <Field>
        <FieldLabel htmlFor="confirmed-start-time">Start time</FieldLabel>
        <TimePicker id="confirmed-start-time" aria-label="Start time" value={values.confirmedStartTime} onValueChange={setters.setConfirmedStartTime} scrollTo="18:00" />
      </Field>
      <Field>
        <FieldLabel htmlFor="confirmed-end-time">End time</FieldLabel>
        <TimePicker id="confirmed-end-time" aria-label="End time" value={values.confirmedEndTime} onValueChange={setters.setConfirmedEndTime} min={values.confirmedStartTime || undefined} scrollTo={values.confirmedStartTime || "22:00"} />
      </Field>
      <BriefingField label="Styling budget" type="number" min={0} value={values.stylingBudget} onChange={setters.setStylingBudget} />
    </div>
    <Field>
      <FieldLabel htmlFor="briefing-service-requirements">Service requirements <span aria-hidden="true">*</span></FieldLabel>
      <Textarea id="briefing-service-requirements" required value={values.serviceRequirements} onChange={(event) => setters.setServiceRequirements(event.target.value)} placeholder="One requirement per line" />
    </Field>
    <Field>
      <FieldLabel htmlFor="briefing-mood">Mood and styling</FieldLabel>
      <Textarea id="briefing-mood" value={values.moodAndStyling} onChange={(event) => setters.setMoodAndStyling(event.target.value)} placeholder="Describe the look or atmosphere you have in mind" />
    </Field>
    <Field>
      <FieldLabel htmlFor="briefing-notes">Additional notes <span aria-hidden="true">*</span></FieldLabel>
      <Textarea id="briefing-notes" required value={values.notes} onChange={(event) => setters.setNotes(event.target.value)} placeholder="Share constraints, priorities, or questions for your event team" />
    </Field>
    <Button type="submit" disabled={busy}>{busy ? "Submitting…" : briefing ? "Submit updated briefing" : "Submit briefing"}<ArrowRight className="size-4" /></Button></form>
  </PrismSection>;
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
