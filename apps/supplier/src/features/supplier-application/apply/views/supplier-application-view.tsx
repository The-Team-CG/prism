"use client";

import { FormEvent } from "react";
import { useSupplierApplicationViewModel } from "../view-models/use-supplier-application-view-model";
import { SupplierApplicationScreen, SupplierApplicationSubmitted } from "./sections/supplier-application-form-sections";

export function SupplierApplicationView() {
  const {
    form,
    submitted,
    applicationId,
    busy,
    error,
    categories,
    categoriesError,
    categoriesLoading,
    update,
    canSubmit,
    missingItems,
    submit,
    resetSubmitted,
  } = useSupplierApplicationViewModel();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit();
  }

  if (submitted && applicationId) return <SupplierApplicationSubmitted applicationId={applicationId} onReset={resetSubmitted} />;

  return (
    <SupplierApplicationScreen
      form={form}
      update={update}
      categories={categories}
      categoriesError={categoriesError}
      categoriesLoading={categoriesLoading}
      error={error}
      busy={busy}
      canSubmit={canSubmit}
      missingItems={missingItems}
      onSubmit={onSubmit}
    />
  );
}
