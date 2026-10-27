"use client";

import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  LockKeyhole,
  MessageSquareText,
  Send,
  ShieldCheck,
  UserRound,
  WalletCards,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/app/components/ui/field";
import { Input } from "@/app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Textarea } from "@/app/components/ui/textarea";
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

const wizardSteps = INQUIRY_WIZARD_STEPS;
const clientTypes = INQUIRY_CLIENT_TYPES;
const eventTypes = INQUIRY_EVENT_TYPES;
const dateOptions = INQUIRY_DATE_OPTIONS;
const venueOptions = INQUIRY_VENUE_OPTIONS;
const budgetRanges = INQUIRY_BUDGET_RANGES;
const priorityOptions = INQUIRY_PRIORITY_OPTIONS;
const referralSources = INQUIRY_REFERRAL_SOURCES;

const compactControlClass =
  "h-14 rounded-lg border-border bg-white/90 px-5 text-base shadow-sm placeholder:text-muted-foreground/75 focus-visible:border-primary/45 focus-visible:ring-primary/15";
const compactSelectTriggerClass =
  "h-14 rounded-lg border-border bg-white/90 px-5 text-base shadow-sm focus:border-primary/45 focus:ring-primary/15";
const compactTextareaClass =
  "min-h-[120px] rounded-lg border-border bg-white/90 px-5 py-4 text-base shadow-sm placeholder:text-muted-foreground/75 focus-visible:border-primary/45 focus-visible:ring-primary/15";
const compactFieldGroupClass =
  "gap-6 [&_[data-slot=field-description]]:text-base [&_[data-slot=field-label]]:text-base [&_[data-slot=field-label]]:font-black [&_[data-slot=field]]:gap-3";

type InquiryUpdate = <K extends keyof InquiryForm>(key: K, value: InquiryForm[K]) => void;

type InquiryStepProps = {
  form: InquiryForm;
  update: InquiryUpdate;
};

function StepHeading({ title, description, serif = true }: { title: string; description: string; serif?: boolean }) {
  return (
    <div className="mb-10">
      <h2 className={serif ? "prism-serif text-4xl font-black leading-tight text-ink" : "text-4xl font-black leading-tight text-ink"}>{title}</h2>
      <p className="mt-3 text-lg leading-8 text-muted-foreground">{description}</p>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-sm font-black text-foreground">{label}</p>
      <p className="mt-2 text-base leading-7 text-muted-foreground">{value || "Not provided yet"}</p>
    </div>
  );
}

function SummarySection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-background/95 p-5 shadow-sm">
      <div className="grid gap-5 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
        <span className="grid size-14 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <div>
          <h3 className="text-lg font-black text-foreground">{title}</h3>
          {children}
        </div>
      </div>
    </section>
  );
}

function organizationSummary(form: InquiryForm) {
  return form.companyName || form.clientType;
}

function notesPreview(form: InquiryForm) {
  return form.message || "No additional notes provided.";
}

function budgetRangeButtonClass(selected: boolean) {
  if (selected) {
    return "h-[72px] rounded-lg border border-primary bg-primary text-base font-black text-primary-foreground shadow-[0_14px_36px_rgba(202,18,96,0.18)]";
  }
  return "h-[72px] rounded-lg border border-border bg-background text-base font-black text-foreground transition hover:border-primary/45 hover:text-primary";
}

function ContactStep({ form, update }: InquiryStepProps) {
  return (
    <section>
      <StepHeading title="Contact Info" description="Where should PMCM send follow-up details?" serif={false} />
      <FieldGroup className={compactFieldGroupClass}>
        <div className="grid gap-x-12 gap-y-7 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="clientName">Full Name</FieldLabel>
            <Input
              id="clientName"
              value={form.clientName}
              onChange={(event) => update("clientName", event.target.value)}
              placeholder="Enter full name"
              required
              className={compactControlClass}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="companyName">Company / Organization</FieldLabel>
            <Input
              id="companyName"
              value={form.companyName}
              onChange={(event) => update("companyName", event.target.value)}
              placeholder="Enter company / organization"
              className={compactControlClass}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email Address</FieldLabel>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              placeholder="Enter email address"
              required
              className={compactControlClass}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="phoneNumber">Phone Number</FieldLabel>
            <Input
              id="phoneNumber"
              value={form.phoneNumber}
              onChange={(event) => update("phoneNumber", event.target.value)}
              placeholder="Enter phone number"
              required
              className={compactControlClass}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel>Client Type</FieldLabel>
          <Select value={form.clientType} onValueChange={(value) => update("clientType", value)}>
            <SelectTrigger className={compactSelectTriggerClass}>
              <SelectValue placeholder="Select client type" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {clientTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Referral Source</FieldLabel>
          <Select value={form.source} onValueChange={(value) => update("source", value)}>
            <SelectTrigger className={compactSelectTriggerClass}>
              <SelectValue placeholder="How did you hear about us?" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {referralSources.map((sourceOption) => (
                  <SelectItem key={sourceOption} value={sourceOption}>
                    {sourceOption}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
    </section>
  );
}

function EventDetailsStep({ form, update, minDate }: InquiryStepProps & { minDate: string }) {
  return (
    <section>
      <StepHeading title="Event Details" description="What event should PMCM review?" />
      <FieldGroup className={compactFieldGroupClass}>
        <div className="grid gap-x-12 gap-y-7 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="eventName">Event Name</FieldLabel>
            <Input
              id="eventName"
              value={form.eventName}
              onChange={(event) => update("eventName", event.target.value)}
              placeholder="Enter event name"
              required
              className={compactControlClass}
            />
          </Field>
          <Field>
            <FieldLabel>Event Type</FieldLabel>
            <Select value={form.eventType} onValueChange={(value) => update("eventType", value)}>
              <SelectTrigger className={compactSelectTriggerClass}>
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {eventTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="eventDate">Preferred Date</FieldLabel>
            <Input
              id="eventDate"
              type="date"
              min={minDate}
              value={form.eventDate}
              onChange={(event) => update("eventDate", event.target.value)}
              required
              className={compactControlClass}
            />
          </Field>
          <Field>
            <FieldLabel>Date Flexibility</FieldLabel>
            <Select value={form.dateFlexibility} onValueChange={(value) => update("dateFlexibility", value)}>
              <SelectTrigger className={compactSelectTriggerClass}>
                <SelectValue placeholder="Select date flexibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {dateOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="expectedGuests">Expected Number of Guests</FieldLabel>
          <Input
            id="expectedGuests"
            type="number"
            min="1"
            value={form.expectedGuests}
            onChange={(event) => update("expectedGuests", event.target.value)}
            placeholder="e.g., 150"
            required
            className={compactControlClass}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="venueCity">Venue or City</FieldLabel>
          <Input
            id="venueCity"
            value={form.venueCity}
            onChange={(event) => update("venueCity", event.target.value)}
            placeholder="e.g., Manila, Philippines"
            className={compactControlClass}
          />
          <FieldDescription>A general city is enough if the venue is not final.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>Venue Status</FieldLabel>
          <Select value={form.venueStatus} onValueChange={(value) => update("venueStatus", value)}>
            <SelectTrigger className={compactSelectTriggerClass}>
              <SelectValue placeholder="Confirmed, shortlisted, or still looking" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {venueOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
    </section>
  );
}

function BudgetNotesStep({ form, update }: InquiryStepProps) {
  return (
    <section>
      <StepHeading title="Budget & Notes" description="Help PMCM understand the scale and urgency." />
      <FieldGroup className={compactFieldGroupClass}>
        <Field>
          <FieldLabel>Budget range</FieldLabel>
          <div className="grid gap-4 md:grid-cols-3">
            {budgetRanges.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => update("budgetRange", range)}
                className={budgetRangeButtonClass(form.budgetRange === range)}
              >
                {range}
              </button>
            ))}
          </div>
        </Field>
        <Field>
          <FieldLabel>Inquiry Priority</FieldLabel>
          <Select value={form.inquiryPriority} onValueChange={(value) => update("inquiryPriority", value)}>
            <SelectTrigger className={compactSelectTriggerClass}>
              <SelectValue placeholder="Standard, urgent, or date-sensitive" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {priorityOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="message">Additional Notes</FieldLabel>
          <Textarea
            id="message"
            value={form.message}
            onChange={(event) => update("message", event.target.value)}
            placeholder="Share goals, concerns, theme, venue context, timing, or anything PMCM should know."
            rows={5}
            maxLength={1000}
            className={compactTextareaClass}
          />
          <FieldDescription className="text-right">{form.message.length} / 1000</FieldDescription>
        </Field>
        <div className="flex items-start gap-5 rounded-lg border border-primary/15 bg-primary/5 p-5 text-base leading-7 text-muted-foreground">
          <ShieldCheck className="mt-1 size-8 shrink-0 text-primary" />
          <p>By submitting this inquiry, you agree that PMCM may contact you about this event and process these details for review.</p>
        </div>
      </FieldGroup>
    </section>
  );
}

function ConfirmInquiryStep({ form, update, error }: InquiryStepProps & { error: string | null }) {
  return (
    <section>
      <StepHeading title="Confirm Inquiry" description="PMCM will review these details and contact you with next steps." />
      <div className="grid gap-4">
        <SummarySection icon={<UserRound className="size-7" />} title="Contact summary">
          <div className="mt-4 grid gap-5 md:grid-cols-4">
            <SummaryItem label="Full Name" value={form.clientName} />
            <SummaryItem label="Email" value={form.email} />
            <SummaryItem label="Phone" value={form.phoneNumber} />
            <SummaryItem label="Organization" value={organizationSummary(form)} />
          </div>
        </SummarySection>

        <SummarySection icon={<CalendarDays className="size-7" />} title="Event summary">
          <div className="mt-4 grid gap-5 md:grid-cols-3">
            <SummaryItem label="Event Name" value={form.eventName} />
            <SummaryItem label="Event Type" value={form.eventType} />
            <SummaryItem label="Preferred Date" value={form.eventDate} />
            <SummaryItem label="Expected Guests" value={form.expectedGuests} />
            <SummaryItem label="Venue or City" value={form.venueCity} />
            <SummaryItem label="Venue Status" value={form.venueStatus} />
          </div>
        </SummarySection>

        <SummarySection icon={<WalletCards className="size-7" />} title="Budget summary">
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <SummaryItem label="Estimated Budget" value={form.budgetRange} />
            <SummaryItem label="Inquiry Priority" value={form.inquiryPriority} />
          </div>
        </SummarySection>

        <SummarySection icon={<MessageSquareText className="size-7" />} title="Notes preview">
          <p className="mt-3 text-base leading-7 text-muted-foreground">{notesPreview(form)}</p>
        </SummarySection>
      </div>

      <label className="mt-5 flex items-start gap-3 text-base leading-7 text-foreground">
        <input
          type="checkbox"
          checked={form.privacyConsentAccepted}
          onChange={(event) => update("privacyConsentAccepted", event.target.checked)}
          required
          className="mt-1 size-5 accent-primary"
        />
        <span>I confirm these inquiry details are accurate enough for PMCM review.</span>
      </label>
      <div className="mt-2 flex items-start gap-3 text-base leading-7 text-muted-foreground">
        <LockKeyhole className="mt-1 size-5 shrink-0 text-muted-foreground" />
        <span>PMCM will use this information only to review and follow up on this event inquiry.</span>
      </div>

      {error ? (
        <Alert variant="destructive" className="mt-4 rounded-lg">
          <AlertTitle>Submission failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="ml-auto mt-4 flex w-full max-w-[560px] items-center gap-3 rounded-md border border-success/20 bg-success/8 px-5 py-3 text-sm font-medium text-success">
        <CheckCircle2 className="size-5 shrink-0" />
        After submission, PMCM sends next steps if the inquiry is accepted.
      </div>
    </section>
  );
}

export function InquiryStepBody({
  currentStep,
  form,
  update,
  minDate,
  error,
}: InquiryStepProps & { currentStep: number; minDate: string; error: string | null }) {
  if (currentStep === 0) return <ContactStep form={form} update={update} />;
  if (currentStep === 1) return <EventDetailsStep form={form} update={update} minDate={minDate} />;
  if (currentStep === 2) return <BudgetNotesStep form={form} update={update} />;
  if (currentStep === 3) return <ConfirmInquiryStep form={form} update={update} error={error} />;
  return null;
}

export function InquiryWizardFooter({
  currentStep,
  busy,
  canSubmit,
  onBack,
  onContinue,
}: {
  currentStep: number;
  busy: boolean;
  canSubmit: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  const isLast = currentStep >= wizardSteps.length - 1;
  return (
    <div className="flex min-h-[148px] items-center justify-between gap-3 border-t border-border bg-card px-6 py-7 sm:px-10 lg:px-12">
      {currentStep > 0 ? (
        <Button type="button" variant="outline" onClick={onBack} disabled={busy} className="h-14 rounded-lg px-8 text-base font-black">
          <ChevronLeft className="size-5" />
          Back
        </Button>
      ) : (
        <span />
      )}
      {isLast ? (
        <Button type="submit" disabled={!canSubmit || busy} className="h-[68px] min-w-[264px] rounded-lg px-12 text-lg font-black">
          {busy ? "Submitting..." : "Submit Inquiry"}
          <Send className="size-6" />
        </Button>
      ) : (
        <Button type="button" onClick={onContinue} disabled={busy} className="h-[68px] min-w-[264px] rounded-lg px-12 text-lg font-black">
          Continue
          <ArrowRight className="size-6" />
        </Button>
      )}
    </div>
  );
}
