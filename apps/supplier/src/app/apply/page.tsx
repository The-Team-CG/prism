"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  LockKeyhole,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { prismApi, type CreateSupplierApplicationInput } from "@/lib/prism-api";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "../components/ui/field";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";

type ApplicationForm = {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  categoryId: string;
  pastEvents: string;
  serviceInclusions: string;
  priceRange: string;
  certifications: string;
  portfolioUrl: string;
  additionalNotes: string;
  bniMember: boolean;
  privacyConsentAccepted: boolean;
  privacyNoticeVersion: string;
};

const PRIVACY_NOTICE_VERSION = "2026-05-01";

const initialForm: ApplicationForm = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  categoryId: "",
  pastEvents: "",
  serviceInclusions: "",
  priceRange: "",
  certifications: "",
  portfolioUrl: "",
  additionalNotes: "",
  bniMember: false,
  privacyConsentAccepted: false,
  privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
};

const wizardSteps = ["Company Info", "Services & Portfolio", "Certifications", "Review & Submit"];

const priceRanges = [
  "Below PHP 50k",
  "PHP 50k-150k",
  "PHP 150k-500k",
  "PHP 500k-1M",
  "PHP 1M+",
  "TBD / Flexible",
];

const compactControlClass =
  "h-14 rounded-lg border-[#DDE3EA] bg-white/90 px-5 text-base shadow-sm placeholder:text-muted-foreground/75 focus-visible:border-primary/45 focus-visible:ring-primary/15";
const compactSelectTriggerClass =
  "h-14 rounded-lg border-[#DDE3EA] bg-white/90 px-5 text-base shadow-sm focus:border-primary/45 focus:ring-primary/15";
const compactTextareaClass =
  "min-h-[120px] rounded-lg border-[#DDE3EA] bg-white/90 px-5 py-4 text-base shadow-sm placeholder:text-muted-foreground/75 focus-visible:border-primary/45 focus-visible:ring-primary/15";
const compactFieldGroupClass =
  "gap-6 [&_[data-slot=field-description]]:text-base [&_[data-slot=field-label]]:text-base [&_[data-slot=field-label]]:font-black [&_[data-slot=field]]:gap-3";

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
  const items = ["No account required", "Reviewed by PMCM", "Response within 5 business days"];

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

function ApplyAside({ submitted = false }: { submitted?: boolean }) {
  return (
    <aside className="relative flex min-h-[360px] flex-col justify-between overflow-hidden border-r border-primary/10 bg-card/50 px-8 py-7 sm:px-10 lg:min-h-[944px]">
      <div className="pointer-events-none absolute -bottom-56 -left-24 size-[34rem] rounded-full border border-primary/20" />
      <div className="pointer-events-none absolute -bottom-40 left-44 size-[30rem] rounded-full border border-primary/20" />
      <div className="pointer-events-none absolute bottom-60 right-[3.25rem] hidden size-5 rotate-45 bg-primary shadow-[0_0_28px_rgba(202,18,96,0.24)] lg:block" />
      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="size-6" />
          </div>
          <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Supplier Portal</span>
        </div>
        <div className="mt-[4.5rem] inline-flex h-14 min-w-[304px] items-center justify-center gap-3 rounded-full border border-primary/35 bg-primary/5 px-8 text-sm font-black uppercase tracking-[0.18em] text-primary">
          <Sparkles className="size-5" />
          Supplier application
        </div>
        <h1 className="mt-9 max-w-[24rem] prism-serif text-[3.5rem] font-black leading-[1.03] text-(--prism-ink)">
          Join PMCM&apos;s supplier network<span className="text-primary">.</span>
        </h1>
        <p className="mt-8 max-w-[15.5rem] text-lg leading-8 text-muted-foreground">
          {submitted
            ? "Application received. PMCM will review and respond within 5 business days."
            : "Apply to become an approved PMCM supplier. Share your company details and service offerings."}
        </p>
        <TrustList />
      </div>
      <p className="relative mt-12 text-sm text-muted-foreground">(c) 2026 PMCM Events</p>
    </aside>
  );
}

function SummaryItem({ label, value }: { label: string; value?: string | boolean }) {
  return (
    <div>
      <p className="text-sm font-black text-foreground">{label}</p>
      <p className="mt-2 text-base leading-7 text-muted-foreground">
        {value === true ? "Yes" : value === false ? "No" : value || "Not provided"}
      </p>
    </div>
  );
}

function SummarySection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
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

export default function SupplierApplyPage() {
  const [form, setForm] = useState<ApplicationForm>(initialForm);
  const [currentStep, setCurrentStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    prismApi
      .listSupplierCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  function update<K extends keyof ApplicationForm>(key: K, value: ApplicationForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function canContinue(step = currentStep) {
    if (step === 0) return Boolean(form.companyName && form.contactName && form.email);
    if (step === 1) return Boolean(form.categoryId);
    return form.privacyConsentAccepted;
  }

  function nextStep() {
    if (!canContinue()) return;
    setCurrentStep((step) => Math.min(step + 1, wizardSteps.length - 1));
  }

  function previousStep() {
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  function buildPayload(): CreateSupplierApplicationInput {
    return {
      companyName: form.companyName,
      contactName: form.contactName,
      email: form.email,
      phone: form.phone || undefined,
      categoryId: form.categoryId || undefined,
      pastEvents: form.pastEvents || undefined,
      serviceInclusions: form.serviceInclusions || undefined,
      priceRange: form.priceRange || undefined,
      certifications: form.certifications || undefined,
      portfolioUrl: form.portfolioUrl || undefined,
      additionalNotes: form.additionalNotes || undefined,
      bniMember: form.bniMember,
      privacyConsentAccepted: form.privacyConsentAccepted,
      privacyNoticeVersion: form.privacyNoticeVersion,
    };
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canContinue(3)) return;
    setBusy(true);
    setError(null);

    try {
      await prismApi.createSupplierApplication(buildPayload());
      setSubmitted(true);
      setForm(initialForm);
      setCurrentStep(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit application");
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
            <ApplyAside submitted />
            <section className="grid min-h-screen place-items-center px-5 py-6 lg:px-7">
              <div className="max-w-xl text-center">
                <span className="mx-auto grid size-20 place-items-center rounded-full bg-(--prism-success)/10 text-(--prism-success)">
                  <CheckCircle2 className="size-10" />
                </span>
                <h2 className="mt-8 prism-serif text-5xl font-black text-(--prism-ink)">Application submitted.</h2>
                <p className="mt-4 text-lg leading-8 text-muted-foreground">
                  PMCM will review your application and contact you within 5 business days.
                </p>
                <div className="mx-auto mt-6 max-w-sm rounded-lg border border-primary/10 bg-background p-4 text-sm font-bold text-primary">
                  Reference # SAP-{new Date().getFullYear()}-{String(Math.floor(1000 + Math.random() * 9000))}
                </div>
                <Button type="button" onClick={() => setSubmitted(false)} variant="outline" className="mt-7 h-12 rounded-lg px-6 font-black">
                  Submit another application
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
          <ApplyAside />

          <div className="px-5 py-6 lg:pl-0 lg:pr-0">
            <form
              onSubmit={submitApplication}
              className="ml-0 flex min-h-[944px] w-full max-w-[1060px] flex-col overflow-hidden rounded-lg border border-border/80 bg-card/95 shadow-[0_24px_80px_rgba(23,18,22,0.09)] backdrop-blur"
            >
              <div className="px-6 pb-[4.5rem] pt-9 sm:px-10 lg:px-12">
                <Stepper currentStep={currentStep} />
              </div>

              <div className="flex-1 px-6 pb-8 sm:px-10 lg:px-12">
                {currentStep === 0 && (
                  <section>
                    <StepHeading title="Company Info" description="Tell us about your business." serif={false} />
                    <FieldGroup className={compactFieldGroupClass}>
                      <div className="grid gap-x-12 gap-y-7 md:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor="companyName">Company Name *</FieldLabel>
                          <Input
                            id="companyName"
                            value={form.companyName}
                            onChange={(event) => update("companyName", event.target.value)}
                            placeholder="Enter company name"
                            required
                            className={compactControlClass}
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="contactName">Contact Person *</FieldLabel>
                          <Input
                            id="contactName"
                            value={form.contactName}
                            onChange={(event) => update("contactName", event.target.value)}
                            placeholder="Enter contact person name"
                            required
                            className={compactControlClass}
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="email">Email Address *</FieldLabel>
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
                          <FieldLabel htmlFor="phone">Phone Number</FieldLabel>
                          <Input
                            id="phone"
                            value={form.phone}
                            onChange={(event) => update("phone", event.target.value)}
                            placeholder="Enter phone number"
                            className={compactControlClass}
                          />
                        </Field>
                      </div>
                      <Field>
                        <label className="flex items-center gap-3 text-base leading-7 text-foreground">
                          <input
                            type="checkbox"
                            checked={form.bniMember}
                            onChange={(event) => update("bniMember", event.target.checked)}
                            className="size-5 accent-primary"
                          />
                          <span>BNI Member</span>
                        </label>
                        <FieldDescription>Check if your business is a BNI member.</FieldDescription>
                      </Field>
                    </FieldGroup>
                  </section>
                )}

                {currentStep === 1 && (
                  <section>
                    <StepHeading title="Services & Portfolio" description="What services do you offer?" />
                    <FieldGroup className={compactFieldGroupClass}>
                      <Field>
                        <FieldLabel>Service Category *</FieldLabel>
                        <Select value={form.categoryId} onValueChange={(value) => update("categoryId", value)}>
                          <SelectTrigger className={compactSelectTriggerClass}>
                            <SelectValue placeholder="Select service category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {categories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="pastEvents">Past Events Portfolio</FieldLabel>
                        <Textarea
                          id="pastEvents"
                          value={form.pastEvents}
                          onChange={(event) => update("pastEvents", event.target.value)}
                          placeholder="List notable events you have serviced (e.g., corporate galas, weddings, conferences)."
                          rows={4}
                          className={compactTextareaClass}
                        />
                        <FieldDescription>Include event type, client name (if permitted), and scale.</FieldDescription>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="serviceInclusions">Service Inclusions</FieldLabel>
                        <Textarea
                          id="serviceInclusions"
                          value={form.serviceInclusions}
                          onChange={(event) => update("serviceInclusions", event.target.value)}
                          placeholder="Describe what is included in your service offerings (e.g., setup, teardown, equipment, staffing)."
                          rows={4}
                          className={compactTextareaClass}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Price Range</FieldLabel>
                        <Select value={form.priceRange} onValueChange={(value) => update("priceRange", value)}>
                          <SelectTrigger className={compactSelectTriggerClass}>
                            <SelectValue placeholder="Select typical price range" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {priceRanges.map((range) => (
                                <SelectItem key={range} value={range}>
                                  {range}
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
                    <StepHeading title="Certifications & Additional" description="Share credentials and anything else PMCM should know." />
                    <FieldGroup className={compactFieldGroupClass}>
                      <Field>
                        <FieldLabel htmlFor="certifications">Certifications</FieldLabel>
                        <Textarea
                          id="certifications"
                          value={form.certifications}
                          onChange={(event) => update("certifications", event.target.value)}
                          placeholder="List relevant certifications, licenses, or credentials (e.g., DOLE accreditation, food safety, ISO)."
                          rows={4}
                          className={compactTextareaClass}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="portfolioUrl">Portfolio URL</FieldLabel>
                        <Input
                          id="portfolioUrl"
                          type="url"
                          value={form.portfolioUrl}
                          onChange={(event) => update("portfolioUrl", event.target.value)}
                          placeholder="https://your-portfolio.com"
                          className={compactControlClass}
                        />
                        <FieldDescription>Link to your website, Instagram, or portfolio page.</FieldDescription>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="additionalNotes">Additional Notes</FieldLabel>
                        <Textarea
                          id="additionalNotes"
                          value={form.additionalNotes}
                          onChange={(event) => update("additionalNotes", event.target.value)}
                          placeholder="Anything else you want PMCM to know about your business."
                          rows={4}
                          maxLength={1000}
                          className={compactTextareaClass}
                        />
                        <FieldDescription className="text-right">{form.additionalNotes.length} / 1000</FieldDescription>
                      </Field>
                      <div className="flex items-start gap-5 rounded-lg border border-primary/15 bg-primary/5 p-5 text-base leading-7 text-muted-foreground">
                        <ShieldCheck className="mt-1 size-8 shrink-0 text-primary" />
                        <p>By submitting this application, you agree that PMCM may use these details to evaluate your suitability as a supplier.</p>
                      </div>
                    </FieldGroup>
                  </section>
                )}

                {currentStep === 3 && (
                  <section>
                    <StepHeading title="Review & Submit" description="Confirm your details before submitting." />
                    <div className="grid gap-4">
                      <SummarySection icon={<Building2 className="size-7" />} title="Company profile">
                        <div className="mt-4 grid gap-5 md:grid-cols-4">
                          <SummaryItem label="Company Name" value={form.companyName} />
                          <SummaryItem label="Contact Person" value={form.contactName} />
                          <SummaryItem label="Email" value={form.email} />
                          <SummaryItem label="Phone" value={form.phone} />
                          <SummaryItem label="BNI Member" value={form.bniMember} />
                          <SummaryItem label="Service Category" value={categories.find((c) => c.id === form.categoryId)?.name} />
                        </div>
                      </SummarySection>

                      <SummarySection icon={<Sparkles className="size-7" />} title="Services">
                        <div className="mt-4 grid gap-5 md:grid-cols-2">
                          <SummaryItem label="Price Range" value={form.priceRange} />
                          <SummaryItem label="Portfolio URL" value={form.portfolioUrl} />
                        </div>
                        {form.pastEvents && (
                          <div className="mt-4">
                            <p className="text-sm font-black text-foreground">Past Events</p>
                            <p className="mt-2 text-base leading-7 text-muted-foreground whitespace-pre-wrap">{form.pastEvents}</p>
                          </div>
                        )}
                        {form.serviceInclusions && (
                          <div className="mt-4">
                            <p className="text-sm font-black text-foreground">Service Inclusions</p>
                            <p className="mt-2 text-base leading-7 text-muted-foreground whitespace-pre-wrap">{form.serviceInclusions}</p>
                          </div>
                        )}
                      </SummarySection>

                      {(form.certifications || form.additionalNotes) && (
                        <SummarySection icon={<ShieldCheck className="size-7" />} title="Additional details">
                          {form.certifications && (
                            <div className="mt-4">
                              <p className="text-sm font-black text-foreground">Certifications</p>
                              <p className="mt-2 text-base leading-7 text-muted-foreground whitespace-pre-wrap">{form.certifications}</p>
                            </div>
                          )}
                          {form.additionalNotes && (
                            <div className="mt-4">
                              <p className="text-sm font-black text-foreground">Additional Notes</p>
                              <p className="mt-2 text-base leading-7 text-muted-foreground whitespace-pre-wrap">{form.additionalNotes}</p>
                            </div>
                          )}
                        </SummarySection>
                      )}
                    </div>

                    <label className="mt-5 flex items-start gap-3 text-base leading-7 text-foreground">
                      <input
                        type="checkbox"
                        checked={form.privacyConsentAccepted}
                        onChange={(event) => update("privacyConsentAccepted", event.target.checked)}
                        required
                        className="mt-1 size-5 accent-primary"
                      />
                      <span>I confirm the details above are accurate and I consent to PMCM processing this application.</span>
                    </label>
                    <div className="mt-2 flex items-start gap-3 text-base leading-7 text-muted-foreground">
                      <LockKeyhole className="mt-1 size-5 shrink-0 text-muted-foreground" />
                      <span>PMCM will use this information only to evaluate your supplier application.</span>
                    </div>

                    {error && (
                      <Alert variant="destructive" className="mt-4 rounded-lg">
                        <AlertTitle>Submission failed</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    <div className="ml-auto mt-4 flex w-full max-w-[560px] items-center gap-3 rounded-md border border-(--prism-success)/20 bg-(--prism-success)/8 px-5 py-3 text-sm font-medium text-(--prism-success)">
                      <CheckCircle2 className="size-5 shrink-0" />
                      After submission, PMCM will review and respond within 5 business days.
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
                    {busy ? "Submitting..." : "Submit Application"}
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
