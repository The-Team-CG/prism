"use client";

import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { formatInquiryDate } from "../../model/inquiry-submit-rules";
import { cn } from "@/app/components/ui/utils";
import type { InquiryForm } from "../../model/inquiry-submit-types";
import {
  INQUIRY_BUDGET_RANGES,
  INQUIRY_CLIENT_TYPES,
  INQUIRY_DATE_OPTIONS,
  INQUIRY_EVENT_TYPES,
  INQUIRY_PRIORITY_OPTIONS,
  INQUIRY_REFERRAL_SOURCES,
  INQUIRY_VENUE_OPTIONS,
  INQUIRY_WIZARD_STEPS,
} from "../../model/inquiry-submit-types";
import { InquiryChoiceGroup } from "./inquiry-choice-group";

const controlClass = "h-11 rounded-lg border-border-strong bg-white px-3.5 text-base md:text-base";

type InquiryUpdate = <K extends keyof InquiryForm>(key: K, value: InquiryForm[K]) => void;
type InquiryStepProps = { form: InquiryForm; update: InquiryUpdate };

const STEP_COPY = [
  { title: "What are you planning?", intro: "Start with the event itself. A working name is fine." },
  { title: "Where, and on what budget?", intro: "Rough answers help PMCM size the team and the venue." },
  { title: "Who should PMCM reply to?", intro: "PMCM replies by email and may call to check details." },
  { title: "Check it, then send it", intro: "This is the brief PMCM receives. Edit anything that is off." },
] as const;

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  hint,
  min,
  inputMode,
  autoComplete,
}: {
  id: keyof InquiryForm;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  min?: string;
  inputMode?: "numeric" | "tel" | "email" | "text";
  autoComplete?: string;
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
        {required ? null : <span className="font-normal text-muted-foreground"> (optional)</span>}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        min={min}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={controlClass}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function EventStep({ form, update, minDate }: InquiryStepProps & { minDate: string }) {
  return (
    <div className="grid gap-7">
      <InquiryChoiceGroup label="What kind of event?" options={INQUIRY_EVENT_TYPES} value={form.eventType} onChange={(value) => update("eventType", value)} required />
      <TextField id="eventName" label="Event name" value={form.eventName} onChange={(value) => update("eventName", value)} placeholder="For example, Annual sales kickoff" required />
      <div className="grid gap-7 md:grid-cols-2">
        <TextField id="eventDate" label="Preferred date" type="date" min={minDate} value={form.eventDate} onChange={(value) => update("eventDate", value)} required />
        <TextField id="expectedGuests" label="Expected guests" type="number" min="1" inputMode="numeric" value={form.expectedGuests} onChange={(value) => update("expectedGuests", value)} placeholder="150" required />
      </div>
      <InquiryChoiceGroup label="How fixed is the date?" options={INQUIRY_DATE_OPTIONS} value={form.dateFlexibility} onChange={(value) => update("dateFlexibility", value)} />
    </div>
  );
}

function VenueBudgetStep({ form, update }: InquiryStepProps) {
  return (
    <div className="grid gap-7">
      <TextField id="venueCity" label="Venue or city" value={form.venueCity} onChange={(value) => update("venueCity", value)} placeholder="For example, Makati" hint="A city is enough if the venue is not final." />
      <InquiryChoiceGroup label="Venue status" options={INQUIRY_VENUE_OPTIONS} value={form.venueStatus} onChange={(value) => update("venueStatus", value)} />
      <InquiryChoiceGroup label="Budget range" options={INQUIRY_BUDGET_RANGES} value={form.budgetRange} onChange={(value) => update("budgetRange", value)} required />
      <InquiryChoiceGroup label="How soon do you need a reply?" options={INQUIRY_PRIORITY_OPTIONS} value={form.inquiryPriority} onChange={(value) => update("inquiryPriority", value)} required />
      <div className="grid gap-2">
        <label htmlFor="message" className="text-sm font-semibold text-foreground">
          Anything else PMCM should know <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="message"
          value={form.message}
          onChange={(event) => update("message", event.target.value)}
          placeholder="Goals, theme, program, timing, or concerns."
          rows={4}
          maxLength={1000}
          className="min-h-28 rounded-lg border-border-strong bg-white px-3.5 py-3 text-base md:text-base"
        />
        <p className="text-right text-sm tabular-nums text-muted-foreground">{form.message.length} / 1000</p>
      </div>
    </div>
  );
}

function DetailsStep({ form, update }: InquiryStepProps) {
  return (
    <div className="grid gap-7">
      <div className="grid gap-7 md:grid-cols-2">
        <TextField id="clientName" label="Full name" value={form.clientName} onChange={(value) => update("clientName", value)} autoComplete="name" required />
        <TextField id="companyName" label="Company or organisation" value={form.companyName} onChange={(value) => update("companyName", value)} autoComplete="organization" />
        <TextField id="email" label="Email" type="email" inputMode="email" value={form.email} onChange={(value) => update("email", value)} autoComplete="email" required />
        <TextField id="phoneNumber" label="Mobile number" type="tel" inputMode="tel" value={form.phoneNumber} onChange={(value) => update("phoneNumber", value)} placeholder="0917 123 4567" autoComplete="tel" required />
      </div>
      <InquiryChoiceGroup label="You are booking as" options={INQUIRY_CLIENT_TYPES} value={form.clientType} onChange={(value) => update("clientType", value)} required />
      <InquiryChoiceGroup label="How did you hear about PMCM?" options={INQUIRY_REFERRAL_SOURCES} value={form.source} onChange={(value) => update("source", value)} required />
    </div>
  );
}

function ReviewStep({
  form,
  update,
  error,
  onEdit,
}: InquiryStepProps & { error: string | null; onEdit: (step: number) => void }) {
  const groups = [
    { step: 0, title: "Event", rows: [["Name", form.eventName], ["Type", form.eventType], ["Date", formatInquiryDate(form.eventDate)], ["Date flexibility", form.dateFlexibility], ["Guests", form.expectedGuests]] },
    { step: 1, title: "Venue and budget", rows: [["Venue or city", form.venueCity], ["Venue status", form.venueStatus], ["Budget", form.budgetRange], ["Reply needed", form.inquiryPriority], ["Notes", form.message]] },
    { step: 2, title: "Your details", rows: [["Name", form.clientName], ["Organisation", form.companyName], ["Email", form.email], ["Mobile", form.phoneNumber], ["Booking as", form.clientType], ["Heard via", form.source]] },
  ] as const;
  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        {groups.map((group) => (
          <section key={group.title} aria-label={group.title} className="rounded-lg bg-surface-raised px-4 py-4 sm:px-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
              <button type="button" onClick={() => onEdit(group.step)} className="text-sm font-semibold text-primary hover:text-primary-strong">
                Edit<span className="sr-only"> {group.title.toLowerCase()}</span>
              </button>
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {group.rows.map(([label, value]) => (
                <div key={label} className={cn("grid grid-cols-[6.25rem_minmax(0,1fr)] gap-3 text-sm sm:grid-cols-[7.5rem_minmax(0,1fr)]", label === "Notes" && "sm:col-span-2")}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className={cn("[overflow-wrap:anywhere]", value ? "text-foreground" : "text-muted-foreground")}>{value || "–"}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <label className="flex items-start gap-3 text-base text-foreground">
        <input
          type="checkbox"
          checked={form.privacyConsentAccepted}
          onChange={(event) => update("privacyConsentAccepted", event.target.checked)}
          required
          className="mt-1 size-5 shrink-0 accent-primary"
        />
        <span>
          PMCM may use these details to review this inquiry and contact me about it.{" "}
          <a href="/privacy" className="font-semibold text-primary hover:text-primary-strong">
            Privacy notice
          </a>
        </span>
      </label>

      {error ? (
        <Alert variant="destructive" className="rounded-lg">
          <AlertTitle>The inquiry was not sent</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function InquiryStepBody({
  currentStep,
  form,
  update,
  minDate,
  error,
  onEdit,
}: InquiryStepProps & { currentStep: number; minDate: string; error: string | null; onEdit: (step: number) => void }) {
  return (
    <section aria-labelledby="inquiry-step-title">
      <h2 id="inquiry-step-title" className="font-heading text-xl font-bold text-foreground">
        {STEP_COPY[currentStep]?.title}
      </h2>
      <p className="mt-1 text-base text-muted-foreground">{STEP_COPY[currentStep]?.intro}</p>
      <div className="mt-7">
        {currentStep === 0 ? <EventStep form={form} update={update} minDate={minDate} /> : null}
        {currentStep === 1 ? <VenueBudgetStep form={form} update={update} /> : null}
        {currentStep === 2 ? <DetailsStep form={form} update={update} /> : null}
        {currentStep === 3 ? <ReviewStep form={form} update={update} error={error} onEdit={onEdit} /> : null}
      </div>
    </section>
  );
}

function listInWords(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function InquiryWizardFooter({
  currentStep,
  busy,
  missing,
  onBack,
  onContinue,
}: {
  currentStep: number;
  busy: boolean;
  missing: string[];
  onBack: () => void;
  onContinue: () => void;
}) {
  const isLast = currentStep >= INQUIRY_WIZARD_STEPS.length - 1;
  return (
    <div className="mt-8">
      {missing.length ? (
        <p role="alert" className="mb-4 rounded-lg bg-attention-soft px-4 py-3 text-sm font-medium text-attention">
          To continue, add {listInWords(missing)}.
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
      {currentStep > 0 ? (
        <Button type="button" variant="ghost" onClick={onBack} disabled={busy} className="h-11 px-3 text-base shadow-none">
          <ArrowLeft className="size-4" />
          Back
        </Button>
      ) : (
        <span />
      )}
      {isLast ? (
        <Button type="submit" disabled={busy} className="h-11 rounded-lg px-6 text-base shadow-none">
          {busy ? "Sending…" : "Send inquiry"}
          <Send className="size-4" />
        </Button>
      ) : (
        <Button type="button" onClick={onContinue} disabled={busy} className="h-11 rounded-lg px-6 text-base shadow-none">
          Continue
          <ArrowRight className="size-4" />
        </Button>
      )}
      </div>
    </div>
  );
}
