"use client";

import { FormEvent, type ReactNode, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  Flower2,
  LockKeyhole,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { mvpApi, type CreateMvpInquiryInput } from "@/lib/mvp-api";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";

type InquiryForm = {
  clientName: string;
  companyName: string;
  email: string;
  phoneNumber: string;
  clientType: string;
  eventName: string;
  eventType: string;
  eventDate: string;
  dateFlexibility: string;
  expectedGuests: string;
  venueCity: string;
  venueStatus: string;
  budgetRange: string;
  inquiryPriority: string;
  message: string;
  source: string;
  privacyConsentAccepted: boolean;
  privacyNoticeVersion: string;
  marketingConsentAccepted: boolean;
};

const PRIVACY_NOTICE_VERSION = "2026-05-01";

const initialForm: InquiryForm = {
  clientName: "",
  companyName: "",
  email: "",
  phoneNumber: "",
  clientType: "",
  eventName: "",
  eventType: "",
  eventDate: "",
  dateFlexibility: "",
  expectedGuests: "",
  venueCity: "",
  venueStatus: "",
  budgetRange: "",
  inquiryPriority: "",
  message: "",
  source: "Website",
  privacyConsentAccepted: false,
  privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
  marketingConsentAccepted: false,
};

const wizardSteps = ["Contact Info", "Event Details", "Budget & Notes", "Confirm"];

const clientTypes = ["Corporate", "Private", "Government", "School", "Non-profit", "Other"];
const eventTypes = [
  "Corporate event",
  "Conference",
  "Gala",
  "Product launch",
  "Private celebration",
  "Training or workshop",
  "Other",
];
const dateOptions = ["Fixed date", "Flexible by a few days", "Flexible by a few weeks", "Still deciding"];
const venueOptions = ["Confirmed", "Shortlisted", "Still looking", "Not applicable yet"];
const budgetRanges = ["Below PHP 50k", "PHP 50k-150k", "PHP 150k-500k", "PHP 500k-1M", "PHP 1M+", "TBD / Flexible"];
const priorityOptions = ["Standard", "Urgent", "Date-sensitive"];

const compactControlClass =
  "h-14 rounded-lg border-[#DDE3EA] bg-white/90 px-5 text-base shadow-sm placeholder:text-muted-foreground/75 focus-visible:border-primary/45 focus-visible:ring-primary/15";
const compactSelectTriggerClass =
  "h-14 rounded-lg border-[#DDE3EA] bg-white/90 px-5 text-base shadow-sm focus:border-primary/45 focus:ring-primary/15";
const compactTextareaClass =
  "min-h-[120px] rounded-lg border-[#DDE3EA] bg-white/90 px-5 py-4 text-base shadow-sm placeholder:text-muted-foreground/75 focus-visible:border-primary/45 focus-visible:ring-primary/15";
const compactFieldGroupClass =
  "gap-6 [&_[data-slot=field-description]]:text-base [&_[data-slot=field-label]]:text-base [&_[data-slot=field-label]]:font-black [&_[data-slot=field]]:gap-3";

function BrandMark() {
  return (
    <a href="/" className="flex items-center gap-4 no-underline" aria-label="PMCM P.R.I.S.M home">
      <span className="grid place-items-center">
        <Flower2 className="size-11 fill-primary text-primary" strokeWidth={1.8} />
      </span>
      <span>
        <span className="block text-3xl font-black leading-none tracking-normal text-(--prism-ink)">PMCM</span>
        <span className="mt-1 block text-xs font-black uppercase tracking-[0.46em] text-muted-foreground">P.R.I.S.M</span>
      </span>
    </a>
  );
}

function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <ol className="flex w-full flex-wrap items-center gap-y-4 lg:flex-nowrap">
      {wizardSteps.map((step, index) => {
        const active = index === currentStep;
        const done = index < currentStep;

        return (
          <li key={step} className={index < wizardSteps.length - 1 ? "contents" : "flex shrink-0 items-center gap-4"}>
            <span className="flex shrink-0 items-center gap-4">
              <span
                className={
                  done || active
                    ? "grid size-11 shrink-0 place-items-center rounded-full bg-primary text-base font-black text-primary-foreground shadow-[0_10px_24px_rgba(202,18,96,0.2)]"
                    : "grid size-11 shrink-0 place-items-center rounded-full bg-muted text-base font-black text-muted-foreground"
                }
              >
                {done ? <Check className="size-5" /> : index + 1}
              </span>
              <span className={active || done ? "whitespace-nowrap text-lg font-black text-foreground" : "whitespace-nowrap text-lg font-medium text-muted-foreground"}>
                {step}
              </span>
            </span>
            {index < wizardSteps.length - 1 && <span aria-hidden="true" className={index < currentStep ? "mx-7 hidden h-px flex-1 bg-primary lg:block" : "mx-7 hidden h-px flex-1 bg-border lg:block"} />}
          </li>
        );
      })}
    </ol>
  );
}

function TrustList() {
  const items = ["No commitment required", "Reviewed by PMCM", "Next steps sent after review"];

  return (
    <div className="mt-10 grid gap-5">
      {items.map((item) => (
        <div key={item} className="flex items-center gap-4 text-base font-medium text-(--prism-ink)">
          <span className="grid size-8 place-items-center rounded-full border border-primary/10 bg-primary/10 text-primary">
            <Check className="size-4" />
          </span>
          {item}
        </div>
      ))}
    </div>
  );
}

function InquiryAside({ submitted = false }: { submitted?: boolean }) {
  return (
    <aside className="relative flex min-h-[360px] flex-col justify-between overflow-hidden border-r border-primary/10 bg-card/50 px-8 py-7 sm:px-10 lg:min-h-[944px]">
      <div className="pointer-events-none absolute -bottom-56 -left-24 size-[34rem] rounded-full border border-primary/20" />
      <div className="pointer-events-none absolute -bottom-40 left-44 size-[30rem] rounded-full border border-primary/20" />
      <div className="pointer-events-none absolute bottom-60 right-[3.25rem] hidden size-5 rotate-45 bg-primary shadow-[0_0_28px_rgba(202,18,96,0.24)] lg:block" />
      <div className="relative">
        <BrandMark />
        <div className="mt-[4.5rem] inline-flex h-14 min-w-[304px] items-center justify-center gap-3 rounded-full border border-primary/35 bg-primary/5 px-8 text-sm font-black uppercase tracking-[0.18em] text-primary">
          <Sparkles className="size-5" />
          PMCM event inquiry
        </div>
        <h1 className="mt-9 max-w-[24rem] prism-serif text-[3.5rem] font-black leading-[1.03] text-(--prism-ink)">
          Tell us about your event<span className="text-primary">.</span>
        </h1>
        <p className="mt-8 max-w-[15.5rem] text-lg leading-8 text-muted-foreground">
          {submitted
            ? "Review complete. PMCM will use your details to decide the next planning step."
            : "Share the basics first. PMCM reviews your inquiry before planning begins."}
        </p>
        <TrustList />
      </div>
      <p className="relative mt-12 text-sm text-muted-foreground">(c) 2026 PMCM Events</p>
    </aside>
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

function StepHeading({ title, description, serif = true }: { title: string; description: string; serif?: boolean }) {
  return (
    <div className="mb-10">
      <h2 className={serif ? "prism-serif text-4xl font-black leading-tight text-(--prism-ink)" : "text-4xl font-black leading-tight text-(--prism-ink)"}>{title}</h2>
      <p className="mt-3 text-lg leading-8 text-muted-foreground">{description}</p>
    </div>
  );
}

export function PublicInquiryPage() {
  const [form, setForm] = useState<InquiryForm>(initialForm);
  const [currentStep, setCurrentStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  function update<K extends keyof InquiryForm>(key: K, value: InquiryForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function canContinue(step = currentStep) {
    if (step === 0) return Boolean(form.clientName && form.email && form.phoneNumber && form.clientType);
    if (step === 1) return Boolean(form.eventName && form.eventType && form.eventDate && form.expectedGuests);
    if (step === 2) return Boolean(form.budgetRange && form.inquiryPriority);
    return form.privacyConsentAccepted;
  }

  function nextStep() {
    if (!canContinue()) return;
    setCurrentStep((step) => Math.min(step + 1, wizardSteps.length - 1));
  }

  function previousStep() {
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  function buildPayload(): CreateMvpInquiryInput {
    const reviewNotes = [
      `Phone: ${form.phoneNumber || "Not provided"}`,
      `Expected guests: ${form.expectedGuests || "Not provided"}`,
      `Venue or city: ${form.venueCity || "Not provided"}`,
      `Venue status: ${form.venueStatus || "Not provided"}`,
      `Date flexibility: ${form.dateFlexibility || "Not provided"}`,
      `Budget range: ${form.budgetRange || "Not provided"}`,
      `Inquiry priority: ${form.inquiryPriority || "Not provided"}`,
      "",
      "Client notes:",
      form.message || "No additional notes provided.",
    ].join("\n");

    return {
      clientName: form.clientName,
      companyName: form.companyName,
      email: form.email,
      eventName: form.eventName,
      eventType: form.eventType,
      eventDate: form.eventDate,
      clientType: form.clientType,
      source: form.source,
      message: reviewNotes,
      privacyConsentAccepted: form.privacyConsentAccepted,
      privacyNoticeVersion: form.privacyNoticeVersion,
      marketingConsentAccepted: form.marketingConsentAccepted,
    };
  }

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canContinue(3)) return;
    setBusy(true);
    setError(null);

    try {
      await mvpApi.createInquiry(buildPayload());
      setSubmitted(true);
      setForm(initialForm);
      setCurrentStep(0);
      toast.success("Inquiry received", {
        description: "PMCM will review the details and contact you with next steps.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit inquiry");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen overflow-auto bg-background text-foreground">
        <section className="relative min-h-screen overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,248,242,0.98),rgba(233,247,251,0.72)_58%,rgba(255,248,242,0.96))]" />
          <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(204,236,244,0.72)_1px,transparent_1px),linear-gradient(90deg,rgba(204,236,244,0.72)_1px,transparent_1px)] [background-size:42px_42px]" />
          <div className="relative grid min-h-screen lg:grid-cols-[452px_minmax(0,1fr)]">
            <InquiryAside submitted />
            <section className="grid min-h-screen place-items-center px-5 py-6 lg:px-7">
              <div className="max-w-xl text-center">
                <span className="mx-auto grid size-20 place-items-center rounded-full bg-(--prism-success)/10 text-(--prism-success)">
                  <CheckCircle2 className="size-10" />
                </span>
                <h2 className="mt-8 prism-serif text-5xl font-black text-(--prism-ink)">Inquiry submitted.</h2>
                <p className="mt-4 text-lg leading-8 text-muted-foreground">
                  PMCM will review your event details and contact you with next steps if the inquiry is accepted.
                </p>
                <div className="mx-auto mt-6 max-w-sm rounded-lg border border-primary/10 bg-background p-4 text-sm font-bold text-primary">
                  Reference # INQ-{new Date().getFullYear()}-{Math.floor(1000 + Math.random() * 9000)}
                </div>
                <Button type="button" onClick={() => setSubmitted(false)} variant="outline" className="mt-7 h-12 rounded-lg px-6 font-black">
                  Submit another inquiry
                </Button>
              </div>
            </section>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-auto bg-background text-foreground">
      <section className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,248,242,0.98),rgba(233,247,251,0.72)_58%,rgba(255,248,242,0.96))]" />
        <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(204,236,244,0.72)_1px,transparent_1px),linear-gradient(90deg,rgba(204,236,244,0.72)_1px,transparent_1px)] [background-size:42px_42px]" />

        <div className="relative grid min-h-screen lg:grid-cols-[452px_minmax(0,1fr)]">
          <InquiryAside />

          <div className="px-5 py-6 lg:pl-0 lg:pr-0">
            <form
              onSubmit={submitInquiry}
              className="ml-0 flex min-h-[944px] w-full max-w-[1060px] flex-col overflow-hidden rounded-lg border border-border/80 bg-card/95 shadow-[0_24px_80px_rgba(23,18,22,0.09)] backdrop-blur"
            >
              <div className="px-6 pb-[4.5rem] pt-9 sm:px-10 lg:px-12">
                <Stepper currentStep={currentStep} />
              </div>

              <div className="flex-1 px-6 pb-8 sm:px-10 lg:px-12">
                {currentStep === 0 && (
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
                    </FieldGroup>
                  </section>
                )}

                {currentStep === 1 && (
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
                )}

                {currentStep === 2 && (
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
                              className={
                                form.budgetRange === range
                                  ? "h-[72px] rounded-lg border border-primary bg-primary text-base font-black text-primary-foreground shadow-[0_14px_36px_rgba(202,18,96,0.18)]"
                                  : "h-[72px] rounded-lg border border-border bg-background text-base font-black text-foreground transition hover:border-primary/45 hover:text-primary"
                              }
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
                )}

                {currentStep === 3 && (
                  <section>
                    <StepHeading title="Confirm Inquiry" description="PMCM will review these details and contact you with next steps." />
                    <div className="grid gap-4">
                      <SummarySection icon={<UserRound className="size-7" />} title="Contact summary">
                        <div className="mt-4 grid gap-5 md:grid-cols-4">
                          <SummaryItem label="Full Name" value={form.clientName} />
                          <SummaryItem label="Email" value={form.email} />
                          <SummaryItem label="Phone" value={form.phoneNumber} />
                          <SummaryItem label="Organization" value={form.companyName || form.clientType} />
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
                        <p className="mt-3 text-base leading-7 text-muted-foreground">{form.message || "No additional notes provided."}</p>
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

                    {error && (
                      <Alert variant="destructive" className="mt-4 rounded-lg">
                        <AlertTitle>Submission failed</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    <div className="ml-auto mt-4 flex w-full max-w-[560px] items-center gap-3 rounded-md border border-(--prism-success)/20 bg-(--prism-success)/8 px-5 py-3 text-sm font-medium text-(--prism-success)">
                      <CheckCircle2 className="size-5 shrink-0" />
                      After submission, PMCM sends next steps if the inquiry is accepted.
                    </div>
                  </section>
                )}
              </div>

              <div className="flex min-h-[148px] items-center justify-between gap-3 border-t border-border bg-card px-6 py-7 sm:px-10 lg:px-12">
                {currentStep > 0 ? (
                  <Button type="button" variant="outline" onClick={previousStep} disabled={busy} className="h-14 rounded-lg px-8 text-base font-black">
                    <ChevronLeft className="size-5" />
                    Back
                  </Button>
                ) : (
                  <span />
                )}
                {currentStep < wizardSteps.length - 1 ? (
                  <Button type="button" onClick={nextStep} disabled={busy} className="h-[68px] min-w-[264px] rounded-lg px-12 text-lg font-black">
                    Continue
                    <ArrowRight className="size-6" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={!canContinue(3) || busy} className="h-[68px] min-w-[264px] rounded-lg px-12 text-lg font-black">
                    {busy ? "Submitting..." : "Submit Inquiry"}
                    <Send className="size-6" />
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
