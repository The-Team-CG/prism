"use client";

import { FormEvent } from "react";
import { useSupplierApplicationViewModel } from "../view-models/use-supplier-application-view-model";
import {
  ApplicationFormShell,
  ApplicationStepBody,
  ApplicationWizardFooter,
  ApplyAside,
  SupplierApplicationSubmitted,
} from "./sections/supplier-application-steps";

export function SupplierApplicationView() {
  const {
    form,
    currentStep,
    submitted,
    applicationId,
    busy,
    error,
    categories,
    categoriesError,
    categoriesLoading,
    update,
    canContinue,
    nextStep,
    previousStep,
    submit,
    resetSubmitted,
    resolveCategoryName,
  } = useSupplierApplicationViewModel();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit();
  }

  if (submitted && applicationId) return <SupplierApplicationSubmitted applicationId={applicationId} onReset={resetSubmitted} />;

  return (
    <main className="h-dvh bg-background text-foreground">
      <section className="relative h-full min-h-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,248,242,0.98),rgba(233,247,251,0.72)_58%,rgba(255,248,242,0.96))]" />
        <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(204,236,244,0.72)_1px,transparent_1px),linear-gradient(90deg,rgba(204,236,244,0.72)_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="relative grid h-full min-h-0 overflow-hidden lg:grid-cols-[452px_minmax(0,1fr)]">
          <ApplyAside />
          <div className="flex h-full min-h-0 min-w-0 justify-center overflow-hidden px-5 py-6 lg:pl-8 lg:pr-8">
            <ApplicationFormShell
              currentStep={currentStep}
              onSubmit={onSubmit}
              footer={
                <ApplicationWizardFooter
                  currentStep={currentStep}
                  busy={busy}
                  canSubmit={canContinue(3)}
                  onBack={previousStep}
                  onContinue={nextStep}
                />
              }
            >
              <ApplicationStepBody
                currentStep={currentStep}
                form={form}
                update={update}
                categories={categories}
                categoriesError={categoriesError}
                categoriesLoading={categoriesLoading}
                error={error}
                resolveCategoryName={resolveCategoryName}
              />
            </ApplicationFormShell>
          </div>
        </div>
      </section>
    </main>
  );
}
