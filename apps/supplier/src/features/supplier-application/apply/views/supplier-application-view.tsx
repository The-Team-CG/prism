"use client";

import { FormEvent } from "react";
import { useSupplierApplicationViewModel } from "../view-models/use-supplier-application-view-model";
import {
  ApplicationFormShell,
  ApplicationStepBody,
  ApplicationWizardFooter,
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
    goToStep,
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
        onEdit={goToStep}
      />
    </ApplicationFormShell>
  );
}
