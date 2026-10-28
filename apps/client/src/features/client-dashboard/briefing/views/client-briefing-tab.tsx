"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
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
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import {
  Card,
  CardBody,
  CardHeader,
  DataRow,
  InfoGrid,
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
import type { SubmitBriefingInput } from "@prism/types";


export function ClientBriefingTab({
  eventId,
  briefing,
  busy,
  onSubmit,
}: {
  eventId: string;
  briefing?: PrismBriefing;
  busy: boolean;
  onSubmit: (eventId: string, input: SubmitBriefingInput) => Promise<void>;
}) {
  const [venue, setVenue] = useState(briefing?.venue ?? "");
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
      stylingBudget: stylingBudget ? Number(stylingBudget) : undefined,
    });
  }

  return <div className="space-y-4">
    <BriefingStatus complete={isComplete} />
    <BriefingSummary briefing={briefing} />
    <BriefingSubmissionForm
      briefing={briefing} busy={busy} onSubmit={handleSubmit}
      values={{ venue, guestCount, budgetRange, serviceRequirements, notes, confirmedDate, confirmedStartTime, confirmedEndTime, moodAndStyling, stylingBudget }}
      setters={{ setVenue, setGuestCount, setBudgetRange, setServiceRequirements, setNotes, setConfirmedDate, setConfirmedStartTime, setConfirmedEndTime, setMoodAndStyling, setStylingBudget }}
    />
  </div>;
}

function BriefingStatus({ complete }: { complete: boolean }) {
  return <div className={`rounded-2xl border px-5 py-4 ${complete ? "border-success/25 bg-success/8" : "border-attention/25 bg-attention-soft"}`}>
    <p className={`text-sm font-bold ${complete ? "text-success" : "text-attention"}`}>{complete ? "Briefing complete" : "Briefing in progress"}</p>
    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{complete ? "All core briefing details are on file." : "Your event team is still confirming the venue, guest count, and service requirements."}</p>
  </div>;
}

function BriefingSummary({ briefing }: { briefing?: PrismBriefing }) {
  return <Card><CardHeader><div className="flex items-center gap-2"><FileCheck2 className="size-4 text-primary" /><h2 className="text-sm font-bold text-foreground">Event briefing</h2></div><p className="mt-0.5 text-xs text-muted-foreground">Confirmed details from your PMCM event team</p></CardHeader><CardBody>
    {briefing ? <InfoGrid items={[{ label: "Venue", value: briefing.venue }, { label: "Guest count", value: `${briefing.guestCount} guests` }, { label: "Budget range", value: briefing.budgetRange }, { label: "Service requirements", value: briefing.serviceRequirements.join(", ") }]} /> : <EmptyState icon={FileCheck2} title="No briefing yet" description="Confirmed venue, schedule, guest count, budget, and service notes will appear here." />}
  </CardBody></Card>;
}

type BriefingValues = Record<string, string>;
type BriefingSetters = Record<string, (value: string) => void>;
function BriefingSubmissionForm({ briefing, busy, onSubmit, values, setters }: {
  briefing?: PrismBriefing;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  values: BriefingValues;
  setters: BriefingSetters;
}) {
  return <Card><CardHeader><div className="flex items-center gap-2"><ClipboardList className="size-4 text-primary" /><h2 className="text-sm font-bold text-foreground">Submit briefing details</h2></div><p className="mt-0.5 text-xs text-muted-foreground">Share your event requirements with PMCM. Each submission is kept in the event history.</p></CardHeader><CardBody>
    <form onSubmit={onSubmit} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">
      <BriefingField label="Venue preference" required value={values.venue} onChange={setters.setVenue} />
      <BriefingField label="Expected guest count" required type="number" min={1} value={values.guestCount} onChange={setters.setGuestCount} />
      <BriefingField label="Budget range" required value={values.budgetRange} onChange={setters.setBudgetRange} />
      <div className="block space-y-1.5 text-xs font-semibold text-muted-foreground">
        <label htmlFor="confirmed-date">Confirmed date</label>
        <DatePicker id="confirmed-date" aria-label="Confirmed date" value={values.confirmedDate} onValueChange={setters.setConfirmedDate} className="w-full rounded-xl border-border bg-background px-3 py-2 text-sm font-normal text-foreground" />
      </div>
      <BriefingField label="Start time" type="time" value={values.confirmedStartTime} onChange={setters.setConfirmedStartTime} />
      <BriefingField label="End time" type="time" value={values.confirmedEndTime} onChange={setters.setConfirmedEndTime} />
      <BriefingField label="Styling budget" type="number" min={0} value={values.stylingBudget} onChange={setters.setStylingBudget} />
    </div>
    <label className="block space-y-1.5 text-xs font-semibold text-muted-foreground">Service requirements <span aria-hidden="true">*</span><textarea required value={values.serviceRequirements} onChange={(event) => setters.setServiceRequirements(event.target.value)} placeholder="One requirement per line" className="min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal text-foreground" /></label>
    <label className="block space-y-1.5 text-xs font-semibold text-muted-foreground">Mood and styling<textarea value={values.moodAndStyling} onChange={(event) => setters.setMoodAndStyling(event.target.value)} placeholder="Describe the look or atmosphere you have in mind" className="min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal text-foreground" /></label>
    <label className="block space-y-1.5 text-xs font-semibold text-muted-foreground">Additional notes <span aria-hidden="true">*</span><textarea required value={values.notes} onChange={(event) => setters.setNotes(event.target.value)} placeholder="Share constraints, priorities, or questions for your event team" className="min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal text-foreground" /></label>
    <Button type="submit" disabled={busy} className="rounded-xl font-bold">{busy ? "Submitting…" : briefing ? "Submit updated briefing" : "Submit briefing"}<ArrowRight className="ml-2 size-4" /></Button></form>
  </CardBody></Card>;
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
  return (
    <label className="block space-y-1.5 text-xs font-semibold text-muted-foreground">
      {label}{required ? " *" : ""}
      <input required={required} type={type} min={min} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal text-foreground" />
    </label>
  );
}
