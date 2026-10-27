"use client";

import { FormEvent } from "react";
import { Check } from "lucide-react";
import { PrismBrandLogo } from "@prism/ui";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/components/ui/utils";
import { inquiryImages } from "../content/inquiry-images";
import { buildInquiryReference, inquiryBriefLine } from "../model/inquiry-submit-rules";
import { INQUIRY_WIZARD_STEPS } from "../model/inquiry-submit-types";
import { useInquirySubmitViewModel } from "../view-models/use-inquiry-submit-view-model";
import { InquiryBrief } from "./sections/inquiry-brief";
import { InquiryStepBody, InquiryWizardFooter } from "./sections/inquiry-submit-steps";

function InquiryHeader() {
  return (
    <header className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between px-5 sm:px-8">
      <PrismBrandLogo href="/" detail="Client portal" compact={false} />
      <a href="/sign-in" className="text-sm font-semibold text-foreground hover:text-primary">
        <span className="hidden sm:inline">Already a client? </span>Sign in
      </a>
    </header>
  );
}

function InquiryProgress({ currentStep, onGoTo }: { currentStep: number; onGoTo: (step: number) => void }) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Inquiry steps">
      {INQUIRY_WIZARD_STEPS.map((step, index) => {
        const done = index < currentStep;
        const active = index === currentStep;
        const label = (
          <>
            <span aria-hidden="true" className={cn("block h-1 rounded-full", done || active ? "bg-primary" : "bg-border")} />
            <span className={cn("mt-2 hidden text-left text-sm sm:block", active ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {done ? <Check aria-hidden="true" className="mr-1 inline size-3.5 text-primary" /> : null}
              {step}
            </span>
          </>
        );
        return (
          <li key={step} aria-current={active ? "step" : undefined}>
            {done ? (
              <button type="button" onClick={() => onGoTo(index)} className="block w-full rounded-sm hover:[&>span]:text-foreground" aria-label={`Back to ${step}`}>
                {label}
              </button>
            ) : (
              label
            )}
          </li>
        );
      })}
    </ol>
  );
}

function InquiryCredits() {
  return (
    <footer className="mx-auto w-full max-w-[1280px] px-5 pb-8 pt-12 text-sm text-muted-foreground sm:px-8">
      <p>PMCM Events Management, Manila · © {new Date().getFullYear()}</p>
      <details className="mt-2">
        <summary className="cursor-pointer">Picture credits</summary>
        <ul className="mt-2 grid gap-1">
          {Object.values(inquiryImages).map((image) => (
            <li key={image.src}>
              <a href={image.page} className="hover:text-foreground">
                {image.credit}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </footer>
  );
}

function InquirySubmittedView({ onReset }: { onReset: () => void }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <InquiryHeader />
      <section className="mx-auto grid w-full max-w-[1280px] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Inquiry sent</h1>
          <p className="mt-3 max-w-[34rem] text-lg text-foreground">
            PMCM will review your event and email you. If PMCM takes it on, you will get a link to open your client account.
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            Reference <span className="font-semibold tabular-nums text-foreground">{buildInquiryReference()}</span>
          </p>
          <Button type="button" variant="outline" onClick={onReset} className="mt-8 h-11 rounded-lg px-5 text-base shadow-none">
            Send another inquiry
          </Button>
        </div>
        <img src={inquiryImages.ballroom.src} alt={inquiryImages.ballroom.alt} className="aspect-[4/3] w-full rounded-xl object-cover" />
      </section>
      <InquiryCredits />
    </main>
  );
}

export function InquirySubmitView() {
  const { form, missing, currentStep, submitted, busy, error, minDate, update, nextStep, previousStep, goToStep, submit, resetSubmitted } =
    useInquirySubmitViewModel();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit();
  }

  if (submitted) return <InquirySubmittedView onReset={resetSubmitted} />;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <InquiryHeader />
      <div className="mx-auto grid w-full max-w-[1280px] gap-10 px-5 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14 lg:pt-10">
        <div className="min-w-0">
          <h1 className="font-heading text-[1.75rem] font-bold leading-tight text-foreground sm:text-3xl">Tell PMCM about your event</h1>
          <p className="mt-2 max-w-[40rem] text-base text-foreground sm:text-lg">
            Four short steps. PMCM reviews every inquiry and replies by email.
          </p>
          <div className="mt-8">
            <InquiryProgress currentStep={currentStep} onGoTo={goToStep} />
          </div>
          {inquiryBriefLine(form) ? (
            <p className="mt-4 truncate text-sm font-medium text-foreground lg:hidden">{inquiryBriefLine(form)}</p>
          ) : null}
          <form onSubmit={onSubmit} className="mt-6 rounded-xl border border-border bg-card p-5 sm:p-8">
            <InquiryStepBody currentStep={currentStep} form={form} update={update} minDate={minDate} error={error} onEdit={goToStep} />
            <InquiryWizardFooter currentStep={currentStep} busy={busy} missing={missing} onBack={previousStep} onContinue={nextStep} />
          </form>
        </div>
        <aside className="grid content-start gap-8 lg:sticky lg:top-6 lg:self-start">
          <InquiryBrief form={form} reviewing={currentStep === INQUIRY_WIZARD_STEPS.length - 1} />
        </aside>
      </div>
      <InquiryCredits />
    </main>
  );
}
