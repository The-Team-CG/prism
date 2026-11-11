"use client";

import { useState, type FormEvent } from "react";
import type { PrismFileRequirementItem } from "@prism/types";
import { DatePicker } from "@prism/ui/components/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import {
  draftFromFileRequirementItem,
  emptyFileRequirementDraft,
  FILE_REQUIREMENT_ROLE_OPTIONS,
  type FileRequirementDraft,
} from "../model/file-requirements-matrix-rules";

const FIELD_CLASS = "mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

export function FileRequirementEditorForm({
  mode,
  item,
  busy,
  error,
  onSave,
  onCancel,
  suppliers,
}: {
  mode: "create" | "edit";
  item?: PrismFileRequirementItem;
  busy: boolean;
  error: string | null;
  onSave: (draft: FileRequirementDraft) => void;
  onCancel: () => void;
  suppliers: Array<{ supplierId: string; supplierName: string }>;
}) {
  const [draft, setDraft] = useState<FileRequirementDraft>(() => (item ? draftFromFileRequirementItem(item) : emptyFileRequirementDraft()));
  const isCustomEdit = mode === "edit" && item?.origin === "custom";
  const canEditLabel = mode === "create" || isCustomEdit;

  function update<K extends keyof FileRequirementDraft>(field: K, value: FileRequirementDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function toggleRole(role: string, checked: boolean) {
    const next = checked ? [...draft.visibleToRoles, role] : draft.visibleToRoles.filter((candidate) => candidate !== role);
    update("visibleToRoles", next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.ownerRole === "supplier" && draft.targetSpecific && !draft.targetSupplierIds?.length) return;
    // PMCM and the owner must always see the requirement; the API rejects drafts that omit either.
    const visibleToRoles = [...new Set([...draft.visibleToRoles, draft.ownerRole, "pmcm-admin"])];
    onSave({ ...draft, visibleToRoles });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md border border-border bg-background p-4 md:grid-cols-2">
      {mode === "create" ? (
        <label className="text-sm">
          Key
          <input required pattern="[a-z][a-z0-9_]{1,62}" value={draft.key} onChange={(event) => update("key", event.target.value)} className={FIELD_CLASS} placeholder="venue_permit" />
        </label>
      ) : null}
      {canEditLabel ? (
        <label className="text-sm">
          Label
          <input required maxLength={120} value={draft.label} onChange={(event) => update("label", event.target.value)} className={FIELD_CLASS} />
        </label>
      ) : null}
      <div className="text-sm">
        <span id="file-requirement-owner">Owner</span>
        <Select value={draft.ownerRole} onValueChange={(next) => update("ownerRole", next)}>
          <SelectTrigger aria-labelledby="file-requirement-owner" className="mt-1 h-10 w-full min-w-0 bg-background px-3 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILE_REQUIREMENT_ROLE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="text-sm">
        <label className="text-sm" htmlFor="file-requirement-due-date">Due date</label>
        <DatePicker id="file-requirement-due-date" value={draft.dueDate} onValueChange={(value) => update("dueDate", value)} aria-label="Due date" className={FIELD_CLASS} />
      </div>
      <fieldset className="text-sm md:col-span-2">
        <legend>Visible to</legend>
        <div className="mt-1 flex flex-wrap gap-4">
          {FILE_REQUIREMENT_ROLE_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={option.value === "pmcm-admin" || draft.visibleToRoles.includes(option.value)}
                disabled={option.value === "pmcm-admin"}
                onChange={(event) => toggleRole(option.value, event.target.checked)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={draft.required} onChange={(event) => update("required", event.target.checked)} />
        Required file
      </label>
      {draft.ownerRole === "supplier" && (mode === "create" || isCustomEdit) ? (
        <fieldset className="text-sm md:col-span-2">
          <legend>Assigned suppliers</legend>
          <label className="mt-1 flex items-center gap-2">
            <input type="checkbox" checked={Boolean(draft.targetSpecific)} onChange={(event) => update("targetSpecific", event.target.checked)} />
            Choose specific suppliers
          </label>
          {draft.targetSpecific ? (
            <div className="mt-2 flex flex-wrap gap-4">
              {suppliers.map((supplier) => (
                <label key={supplier.supplierId} className="flex items-center gap-2">
                  <input type="checkbox" checked={(draft.targetSupplierIds ?? []).includes(supplier.supplierId)} onChange={(event) => {
                    const ids = draft.targetSupplierIds ?? [];
                    update("targetSupplierIds", event.target.checked ? [...ids, supplier.supplierId] : ids.filter((id) => id !== supplier.supplierId));
                  }} />
                  {supplier.supplierName}
                </label>
              ))}
              {(draft.targetSupplierIds ?? []).filter((id) => !suppliers.some((supplier) => supplier.supplierId === id)).map((id) => (
                <label key={id} className="flex items-center gap-2">
                  <input type="checkbox" checked onChange={() => update("targetSupplierIds", (draft.targetSupplierIds ?? []).filter((target) => target !== id))} />
                  Previously assigned supplier ({id}); no longer selected
                </label>
              ))}
              {suppliers.length === 0 ? <span>Select a supplier for the event first.</span> : null}
              {!draft.targetSupplierIds?.length ? <span className="text-destructive">Choose at least one supplier.</span> : null}
            </div>
          ) : <p className="mt-1 text-muted-foreground">Applies to all selected suppliers, including future selections.</p>}
        </fieldset>
      ) : null}
      <label className="text-sm md:col-span-2">
        PMCM notes (never shown to clients or suppliers)
        <textarea rows={2} maxLength={1000} value={draft.notes} onChange={(event) => update("notes", event.target.value)} className={FIELD_CLASS} />
      </label>
      {error ? <p role="alert" className="text-sm text-destructive md:col-span-2">{error}</p> : null}
      <div className="flex gap-2 md:col-span-2">
        <button type="submit" disabled={busy} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          {busy ? "Saving…" : mode === "create" ? "Add requirement" : "Save requirement"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-md border border-border px-3 py-2 text-sm font-semibold">
          Cancel
        </button>
      </div>
    </form>
  );
}
