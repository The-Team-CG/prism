"use client";

import type { FormEvent, ReactNode } from "react";
import { portalHref } from "@prism/ui/portal-path";
import { PRISM_AUTH_INPUT_CLASS_NAME, PrismAuthShell, prismAuthSubmitClassName } from "@prism/ui/auth-shell";
import { CheckCircle2, Send } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@prism/ui/components/alert";
import { Button } from "@prism/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@prism/ui/components/select";
import { Textarea } from "@prism/ui/components/textarea";
import { cn } from "@/app/components/ui/utils";
import { APPLICATION_PRICE_RANGES, type SupplierApplicationForm } from "../../model/supplier-application-types";
import { Card } from "@prism/ui/components/card";

const priceRanges = APPLICATION_PRICE_RANGES;

const APPLY_STATEMENT = "Join PMCM's supplier network.";
const APPLY_POINTS = ["No account required", "Reviewed by PMCM", "Response within 5 business days"] as const;

const controlClass = cn("h-11 bg-card", PRISM_AUTH_INPUT_CLASS_NAME);
const textareaClass = cn("min-h-28 bg-card", PRISM_AUTH_INPUT_CLASS_NAME);

type UpdateFn = <K extends keyof SupplierApplicationForm>(key: K, value: SupplierApplicationForm[K]) => void;

/** One labelled section of the application; the legend names it for screen readers and keeps the page scannable. */
function FormSection({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <FieldSet className="min-w-0 gap-5">
      <FieldLegend className="mb-1 font-semibold text-foreground">{legend}</FieldLegend>
      {children}
    </FieldSet>
  );
}

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
        <Card className="gap-0 flex-row flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Reference number</p>
            <p className="break-all font-mono text-sm font-semibold text-foreground">{applicationId}</p>
          </div>
        </Card>
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

function CompanyFields({ form, update }: { form: SupplierApplicationForm; update: UpdateFn }) {
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

function ServicesFields({
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

function CertificationsFields({ form, update }: { form: SupplierApplicationForm; update: UpdateFn }) {
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

export function SupplierApplicationScreen({
  form,
  update,
  categories,
  categoriesError,
  categoriesLoading,
  error,
  busy,
  canSubmit,
  missingItems,
  onSubmit,
}: {
  form: SupplierApplicationForm;
  update: UpdateFn;
  categories: { id: string; name: string }[];
  categoriesError?: string | null;
  categoriesLoading?: boolean;
  error: string | null;
  busy: boolean;
  canSubmit: boolean;
  missingItems: string[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <PrismAuthShell
      portal="supplier"
      portalName="Supplier portal"
      statement={APPLY_STATEMENT}
      points={APPLY_POINTS}
      title="Apply to become a PMCM supplier"
      description="Everything without “(optional)” is required."
      homeHref={portalHref("/")}
      footer={
        <p>
          Already applied?{" "}
          <a href={portalHref("/status")} className="text-primary hover:text-primary/80">Check application status</a>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-10">
        <FormSection legend="Company">
          <CompanyFields form={form} update={update} />
        </FormSection>
        <FormSection legend="Services and portfolio">
          <ServicesFields form={form} update={update} categories={categories} categoriesError={categoriesError} categoriesLoading={categoriesLoading} />
        </FormSection>
        <FormSection legend="Certifications and notes">
          <CertificationsFields form={form} update={update} />
        </FormSection>
        <FieldSet className="min-w-0 gap-5">
          <FieldLegend className="sr-only">Consent and submission</FieldLegend>
          <label htmlFor="privacyConsentAccepted" className="flex items-start gap-3 text-sm leading-6 text-foreground">
            <input id="privacyConsentAccepted" type="checkbox" checked={form.privacyConsentAccepted} onChange={(event) => update("privacyConsentAccepted", event.target.checked)} required className="mt-1 size-5 shrink-0 accent-primary" />
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
          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={!canSubmit || busy} className={prismAuthSubmitClassName("supplier")}>
              {busy ? "Submitting…" : "Submit application"}
              <Send className="size-4" aria-hidden="true" />
            </Button>
            {!canSubmit ? (
              <FieldDescription className="text-center">Still needed: {missingItems.join(", ")}.</FieldDescription>
            ) : null}
          </div>
        </FieldSet>
      </form>
    </PrismAuthShell>
  );
}
