"use client";

import { FormEvent } from "react";
import { Check, CheckCircle2, Sparkles } from "lucide-react";
import { PrismBrandLogo } from "@prism/ui";
import { Button } from "@/app/components/ui/button";
import { buildInquiryReference } from "../model/inquiry-submit-rules";
import { INQUIRY_WIZARD_STEPS } from "../model/inquiry-submit-types";
import { useInquirySubmitViewModel } from "../view-models/use-inquiry-submit-view-model";
import { InquiryStepBody, InquiryWizardFooter } from "./sections/inquiry-submit-steps";

const wizardSteps = INQUIRY_WIZARD_STEPS;

function BrandMark() {
  return (
    <PrismBrandLogo href="/" detail="Client Inquiry" markClassName="size-12 bg-transparent ring-0" />
  );
}

function stepperMarkerClass(done: boolean, active: boolean) {
  if (done || active) {
    return "grid size-11 shrink-0 place-items-center rounded-full bg-primary text-base font-black text-primary-foreground shadow-[0_10px_24px_rgba(202,18,96,0.2)]";
  }
  return "grid size-11 shrink-0 place-items-center rounded-full bg-muted text-base font-black text-muted-foreground";
}

function stepperLabelClass(done: boolean, active: boolean) {
  if (active || done) return "whitespace-nowrap text-lg font-black text-foreground";
  return "whitespace-nowrap text-lg font-medium text-muted-foreground";
}

function stepperConnectorClass(complete: boolean) {
  if (complete) return "mx-7 hidden h-px flex-1 bg-primary lg:block";
  return "mx-7 hidden h-px flex-1 bg-border lg:block";
}

function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <ol className="flex w-full flex-wrap items-center gap-y-4 lg:flex-nowrap">
      {wizardSteps.map((step, index) => {
        const active = index === currentStep;
        const done = index < currentStep;
        const isLast = index >= wizardSteps.length - 1;

        return (
          <li key={step} className={isLast ? "flex shrink-0 items-center gap-4" : "contents"}>
            <span className="flex shrink-0 items-center gap-4">
              <span className={stepperMarkerClass(done, active)}>
                {done ? <Check className="size-5" /> : index + 1}
              </span>
              <span className={stepperLabelClass(done, active)}>{step}</span>
            </span>
            {isLast ? null : <span aria-hidden="true" className={stepperConnectorClass(index < currentStep)} />}
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

function inquiryAsideCopy(submitted: boolean) {
  if (submitted) return "Review complete. PMCM will use your details to decide the next planning step.";
  return "Share the basics first. PMCM reviews your inquiry before planning begins.";
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
          {inquiryAsideCopy(submitted)}
        </p>
        <TrustList />
      </div>
      <p className="relative mt-12 text-sm text-muted-foreground">(c) 2026 PMCM Events</p>
    </aside>
  );
}

function InquirySubmittedView({ onReset }: { onReset: () => void }) {
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
                Reference # {buildInquiryReference()}
              </div>
              <Button type="button" onClick={onReset} variant="outline" className="mt-7 h-12 rounded-lg px-6 font-black">
                Submit another inquiry
              </Button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export function InquirySubmitView() {
  const {
    form,
    currentStep,
    submitted,
    busy,
    error,
    minDate,
    update,
    canContinue,
    nextStep,
    previousStep,
    submit,
    resetSubmitted,
  } = useInquirySubmitViewModel();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit();
  }

  if (submitted) return <InquirySubmittedView onReset={resetSubmitted} />;

  return (
    <main className="min-h-screen overflow-auto bg-background text-foreground">
      <section className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,248,242,0.98),rgba(233,247,251,0.72)_58%,rgba(255,248,242,0.96))]" />
        <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(204,236,244,0.72)_1px,transparent_1px),linear-gradient(90deg,rgba(204,236,244,0.72)_1px,transparent_1px)] [background-size:42px_42px]" />

        <div className="relative grid min-h-screen lg:grid-cols-[452px_minmax(0,1fr)]">
          <InquiryAside />

          <div className="px-5 py-6 lg:pl-0 lg:pr-0">
            <form
              onSubmit={onSubmit}
              className="ml-0 flex min-h-[944px] w-full max-w-[1060px] flex-col overflow-hidden rounded-lg border border-border/80 bg-card/95 shadow-[0_24px_80px_rgba(23,18,22,0.09)] backdrop-blur"
            >
              <div className="px-6 pb-[4.5rem] pt-9 sm:px-10 lg:px-12">
                <Stepper currentStep={currentStep} />
              </div>

              <div className="flex-1 px-6 pb-8 sm:px-10 lg:px-12">
                <InquiryStepBody currentStep={currentStep} form={form} update={update} minDate={minDate} error={error} />
              </div>

              <InquiryWizardFooter
                currentStep={currentStep}
                busy={busy}
                canSubmit={canContinue(3)}
                onBack={previousStep}
                onContinue={nextStep}
              />
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
