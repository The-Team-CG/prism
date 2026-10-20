"use client";

import { useState, type FormEvent } from "react";
import type { PrismFileRequirementItem } from "@prism/types";
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
}: {
  mode: "create" | "edit";
  item?: PrismFileRequirementItem;
  busy: boolean;
  error: string | null;
  onSave: (draft: FileRequirementDraft) => void;
  onCancel: () => void;
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
      <label className="text-sm">
        Owner
        <select value={draft.ownerRole} onChange={(event) => update("ownerRole", event.target.value)} className={FIELD_CLASS}>
          {FILE_REQUIREMENT_ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Due date
        <input type="date" value={draft.dueDate} onChange={(event) => update("dueDate", event.target.value)} className={FIELD_CLASS} />
      </label>
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
