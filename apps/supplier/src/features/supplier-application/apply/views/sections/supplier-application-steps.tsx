"use client";

import { portalHref } from "@prism/ui/portal-path";
import { PRISM_AUTH_INPUT_CLASS_NAME, PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";

import type { FormEvent, ReactNode } from "react";
import { ArrowRight, CheckCircle2, ChevronLeft, Send } from "lucide-react";
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
import { cn } from "@/app/components/ui/utils";
import { APPLICATION_PRICE_RANGES, APPLICATION_WIZARD_STEPS, type SupplierApplicationForm } from "../../model/supplier-application-types";

const wizardSteps = APPLICATION_WIZARD_STEPS;
const priceRanges = APPLICATION_PRICE_RANGES;

const APPLY_STATEMENT = "Join PMCM's supplier network.";
const APPLY_POINTS = ["No account required", "Reviewed by PMCM", "Response within 5 business days"] as const;

const STEP_COPY: readonly { title: string; description: string }[] = [
  { title: "Company details", description: "Tell PMCM who you are and how to reach you." },
  { title: "Services and portfolio", description: "Describe what you offer and the events you have supplied." },
  { title: "Certifications", description: "Share credentials and anything else PMCM should know." },
  { title: "Review and submit", description: "Check your details before sending them to PMCM." },
];

const controlClass = cn("h-11 bg-card", PRISM_AUTH_INPUT_CLASS_NAME);
const textareaClass = cn("min-h-28 bg-card", PRISM_AUTH_INPUT_CLASS_NAME);

type UpdateFn = <K extends keyof SupplierApplicationForm>(key: K, value: SupplierApplicationForm[K]) => void;

export function SupplierApplicationSubmitted({ applicationId, onReset }: { applicationId: string; onReset: () => void }) {
  return (
    <PrismAuthShell
      portal="supplier"
      portalName="Supplier portal"
      statement={APPLY_STATEMENT}
      points={APPLY_POINTS}
      title="Application submitted"
      description="PMCM will review your application and contact you within 5 business days."
      homeHref={portalHref("/")}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Reference number</p>
            <p className="break-all font-mono text-sm font-semibold text-foreground">{applicationId}</p>
          </div>
        </div>
        <a href={portalHref("/status")} className={cn(prismAuthSubmitClassName("supplier"), "inline-flex items-center justify-center bg-primary text-primary-foreground")}>
          Check application status
        </a>
        <Button type="button" onClick={onReset} variant="outline" className="h-11 w-full rounded-lg">
          Submit another application
        </Button>
      </div>
    </PrismAuthShell>
  );
}

function SummaryItem({ label, value }: { label: string; value?: string | boolean }) {
  const display = value === true ? "Yes" : value === false ? "No" : value;
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 break-words", display ? "text-foreground" : "text-muted-foreground")}>{display || "—"}</dd>
    </div>
  );
}

function SummarySection({ title, step, onEdit, children }: { title: string; step: number; onEdit: (step: number) => void; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <button type="button" onClick={() => onEdit(step)} className="min-h-11 px-2 text-sm text-primary transition-colors hover:text-primary/80">
          Edit
        </button>
      </div>
      <dl className="divide-y divide-border">{children}</dl>
    </section>
  );
}

function CompanyStep({ form, update }: { form: SupplierApplicationForm; update: UpdateFn }) {
  return (
    <FieldGroup className="gap-5">
      <Field>
        <FieldLabel htmlFor="companyName">Company name</FieldLabel>
        <Input id="companyName" autoComplete="organization" value={form.companyName} onChange={(event) => update("companyName", event.target.value)} required className={controlClass} />
      </Field>
      <Field>
        <FieldLabel htmlFor="contactName">Contact person</FieldLabel>
        <Input id="contactName" autoComplete="name" value={form.contactName} onChange={(event) => update("contactName", event.target.value)} required className={controlClass} />
      </Field>
      <Field>
        <FieldLabel htmlFor="email">Email address</FieldLabel>
        <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(event) => update("email", event.target.value)} required className={controlClass} />
      </Field>
      <Field>
        <FieldLabel htmlFor="phone">
          Phone number <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} className={controlClass} />
      </Field>
      <Field>
        <label htmlFor="bniMember" className="flex min-h-11 items-center gap-3 text-sm text-foreground">
          <input id="bniMember" type="checkbox" checked={form.bniMember} onChange={(event) => update("bniMember", event.target.checked)} aria-describedby="bniMember-help" className="size-5 accent-primary" />
          <span>BNI member</span>
        </label>
        <FieldDescription id="bniMember-help">Check this if your business belongs to BNI.</FieldDescription>
      </Field>
    </FieldGroup>
  );
}

function ServicesStep({
  form,
  update,
  categories,
  categoriesError,
  categoriesLoading,
}: {
  form: SupplierApplicationForm;
  update: UpdateFn;
  categories: { id: string; name: string }[];
  categoriesError?: string | null;
  categoriesLoading?: boolean;
}) {
  return (
    <FieldGroup className="gap-5">
      <Field>
        <FieldLabel htmlFor="categoryId">Service category</FieldLabel>
        <Select value={form.categoryId} onValueChange={(value) => update("categoryId", value)} disabled={categoriesLoading || categories.length === 0}>
          <SelectTrigger id="categoryId" aria-describedby={categoriesError ? "categoryId-error" : undefined} className={cn(controlClass, "w-full")}>
            <SelectValue placeholder={categoriesLoading ? "Loading categories…" : "Select a category"} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {categoriesError ? (
          <FieldDescription id="categoryId-error" className="text-danger">
            Couldn&apos;t load service categories ({categoriesError}). Reload the page or contact PMCM.
          </FieldDescription>
        ) : null}
      </Field>
      <Field>
        <FieldLabel htmlFor="priceRange">
          Typical price range <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Select value={form.priceRange} onValueChange={(value) => update("priceRange", value)}>
          <SelectTrigger id="priceRange" className={cn(controlClass, "w-full")}>
            <SelectValue placeholder="Select a range" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {priceRanges.map((range) => (
                <SelectItem key={range} value={range}>{range}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="pastEvents">
          Past events <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Textarea id="pastEvents" value={form.pastEvents} onChange={(event) => update("pastEvents", event.target.value)} aria-describedby="pastEvents-help" rows={4} className={textareaClass} />
        <FieldDescription id="pastEvents-help">Event type, client (if permitted) and scale, e.g. a 300-guest corporate gala.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="serviceInclusions">
          Service inclusions <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Textarea id="serviceInclusions" value={form.serviceInclusions} onChange={(event) => update("serviceInclusions", event.target.value)} aria-describedby="serviceInclusions-help" rows={4} className={textareaClass} />
        <FieldDescription id="serviceInclusions-help">What your package covers: setup, teardown, equipment, staffing.</FieldDescription>
      </Field>
    </FieldGroup>
  );
}

function CertificationsStep({ form, update }: { form: SupplierApplicationForm; update: UpdateFn }) {
  return (
    <FieldGroup className="gap-5">
      <Field>
        <FieldLabel htmlFor="certifications">
          Certifications <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Textarea id="certifications" value={form.certifications} onChange={(event) => update("certifications", event.target.value)} aria-describedby="certifications-help" rows={4} className={textareaClass} />
        <FieldDescription id="certifications-help">Licences or accreditations, e.g. DOLE, food safety, ISO.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="portfolioUrl">
          Portfolio link <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Input id="portfolioUrl" type="url" inputMode="url" value={form.portfolioUrl} onChange={(event) => update("portfolioUrl", event.target.value)} placeholder="https://" aria-describedby="portfolioUrl-help" className={controlClass} />
        <FieldDescription id="portfolioUrl-help">Your website, Instagram or portfolio page.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="additionalNotes">
          Additional notes <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Textarea id="additionalNotes" value={form.additionalNotes} onChange={(event) => update("additionalNotes", event.target.value)} aria-describedby="additionalNotes-count" rows={4} maxLength={1000} className={textareaClass} />
        <FieldDescription id="additionalNotes-count" className="text-right tabular-nums">{form.additionalNotes.length} / 1000</FieldDescription>
      </Field>
    </FieldGroup>
  );
}

function ReviewStep({
  form,
  update,
  error,
  resolveCategoryName,
  onEdit,
}: {
  form: SupplierApplicationForm;
  update: UpdateFn;
  error: string | null;
  resolveCategoryName: (categoryId: string) => string | undefined;
  onEdit: (step: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <SummarySection title="Company" step={0} onEdit={onEdit}>
        <SummaryItem label="Company name" value={form.companyName} />
        <SummaryItem label="Contact person" value={form.contactName} />
        <SummaryItem label="Email" value={form.email} />
        <SummaryItem label="Phone" value={form.phone} />
        <SummaryItem label="BNI member" value={form.bniMember} />
      </SummarySection>
      <SummarySection title="Services" step={1} onEdit={onEdit}>
        <SummaryItem label="Category" value={resolveCategoryName(form.categoryId)} />
        <SummaryItem label="Price range" value={form.priceRange} />
        <SummaryItem label="Past events" value={form.pastEvents} />
        <SummaryItem label="Inclusions" value={form.serviceInclusions} />
      </SummarySection>
      <SummarySection title="Certifications" step={2} onEdit={onEdit}>
        <SummaryItem label="Certifications" value={form.certifications} />
        <SummaryItem label="Portfolio link" value={form.portfolioUrl} />
        <SummaryItem label="Notes" value={form.additionalNotes} />
      </SummarySection>
      <label htmlFor="privacyConsentAccepted" className="flex items-start gap-3 text-sm leading-6 text-foreground">
        <input id="privacyConsentAccepted" type="checkbox" checked={form.privacyConsentAccepted} onChange={(event) => update("privacyConsentAccepted", event.target.checked)} required className="mt-0.5 size-5 shrink-0 accent-primary" />
        <span>
          These details are accurate, and PMCM may use them only to evaluate this supplier application.{" "}
          <a href={portalHref("/privacy")} className="text-primary hover:text-primary/80">Privacy notice</a>
        </span>
      </label>
      {error ? (
        <Alert variant="destructive" className="rounded-lg">
          <AlertTitle>Submission failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function ApplicationStepBody({
  currentStep,
  form,
  update,
  categories,
  categoriesError,
  categoriesLoading,
  error,
  resolveCategoryName,
  onEdit = () => undefined,
}: {
  currentStep: number;
  form: SupplierApplicationForm;
  update: UpdateFn;
  categories: { id: string; name: string }[];
  categoriesError?: string | null;
  categoriesLoading?: boolean;
  error: string | null;
  resolveCategoryName: (categoryId: string) => string | undefined;
  onEdit?: (step: number) => void;
}) {
  if (currentStep === 0) return <CompanyStep form={form} update={update} />;
  if (currentStep === 1)
    return (
      <ServicesStep
        form={form}
        update={update}
        categories={categories}
        categoriesError={categoriesError}
        categoriesLoading={categoriesLoading}
      />
    );
  if (currentStep === 2) return <CertificationsStep form={form} update={update} />;
  return <ReviewStep form={form} update={update} error={error} resolveCategoryName={resolveCategoryName} onEdit={onEdit} />;
}

export function ApplicationWizardFooter({
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
    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
      {currentStep > 0 ? (
        <Button type="button" variant="outline" onClick={onBack} disabled={busy} className="h-12 rounded-lg sm:w-auto sm:px-5">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Back
        </Button>
      ) : null}
      {isLast ? (
        <Button type="submit" disabled={!canSubmit || busy} className={cn(prismAuthSubmitClassName("supplier"), "sm:flex-1")}>
          {busy ? "Submitting…" : "Submit application"}
          <Send className="size-4" aria-hidden="true" />
        </Button>
      ) : (
        <Button type="button" onClick={onContinue} disabled={busy} className={cn(prismAuthSubmitClassName("supplier"), "sm:flex-1")}>
          Continue
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

export function ApplicationFormShell({
  currentStep,
  onSubmit,
  children,
  footer,
}: {
  currentStep: number;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const copy = STEP_COPY[currentStep] ?? STEP_COPY[STEP_COPY.length - 1];
  return (
    <PrismAuthShell
      portal="supplier"
      portalName="Supplier portal"
      statement={APPLY_STATEMENT}
      points={APPLY_POINTS}
      title={copy.title}
      description={copy.description}
      homeHref={portalHref("/")}
      steps={{ current: currentStep + 1, total: wizardSteps.length, label: copy.title }}
      footer={
        <p>
          Already applied?{" "}
          <a href={portalHref("/status")} className="text-primary hover:text-primary/80">Check application status</a>
        </p>
      }
    >
      <form onSubmit={onSubmit}>
        {children}
        {footer}
      </form>
    </PrismAuthShell>
  );
}
