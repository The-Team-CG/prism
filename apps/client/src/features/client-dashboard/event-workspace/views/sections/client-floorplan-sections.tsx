"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import { ArrowRight, MapPinned, Send } from "lucide-react";
import type { PrismFloorPlanDraft } from "@prism/types";
import type { FloorPlanTemplate, Project } from "@/features/floorplan/editor";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { FieldGroup, LayoutPreview, formatStatusLabel } from "../../../workspace/shared";
import type { PreferenceForm } from "../../../workspace/shared";

function templateSubtitle(template: FloorPlanTemplate) {
  return template.description || template.venue || "Saved PMCM floor plan template";
}

export function FloorPlanCardHeader({
  approved,
  activeDraft,
}: {
  approved: boolean;
  activeDraft?: PrismFloorPlanDraft;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">Floor plan workspace</p>
        <h2 className="mt-1 text-xl font-black text-foreground">
          {approved ? "Approved floor plan" : "Editable floor plan"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {approved
            ? "This plan is locked after PMCM approval. It's now the official event record."
            : "Edit and submit your layout before PMCM approval locks it."}
        </p>
      </div>
      {activeDraft ? <StatusBadge status={activeDraft.status} label={formatStatusLabel(activeDraft.status)} /> : null}
    </header>
  );
}

export function FloorPlanDraftPanel({
  approved,
  activeDraft,
  officialProject,
  onOpenEditor,
}: {
  approved: boolean;
  activeDraft?: PrismFloorPlanDraft;
  officialProject: Project | null;
  onOpenEditor: (draft: PrismFloorPlanDraft, readOnly: boolean) => void;
}) {
  if (!activeDraft) {
    return <EmptyState icon={MapPinned} title="No floor plan draft yet" description="Start from a saved layout template or send guided notes below." />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 rounded-xl bg-muted/40 p-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{activeDraft.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {approved ? "Frozen for event reference." : "Open the editor to adjust seating, flow, stage placement, and notes."}
          </p>
        </div>
        <Button className="shrink-0 rounded-lg font-bold" onClick={() => onOpenEditor(activeDraft, approved)}>
          {approved ? "View floor plan" : "Edit floor plan"} <ArrowRight className="size-4" />
        </Button>
      </div>
      <LayoutPreview project={approved ? officialProject : null} />
    </div>
  );
}

export function FloorPlanTemplates({
  approved,
  templates,
  busy,
  onCreate,
}: {
  approved: boolean;
  templates: FloorPlanTemplate[];
  busy: string | null;
  onCreate: (template: FloorPlanTemplate) => void;
}) {
  if (approved) return null;

  return (
    <div className="mt-5">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Saved layout templates</p>
      {templates.length ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {templates.slice(0, 4).map((template) => (
            <button
              key={template.id}
              disabled={busy === `editor-${template.id}`}
              onClick={() => onCreate(template)}
              className="rounded-xl border border-border bg-background p-3.5 text-left transition hover:border-(--prism-signal)/40 hover:bg-(--prism-signal-soft) disabled:opacity-60"
            >
              <p className="text-sm font-bold text-foreground">{template.name}</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{templateSubtitle(template)}</p>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-background p-3.5 text-xs text-muted-foreground">
          No saved templates yet. Send guided layout notes and PMCM can save reusable templates from confirmed plans.
        </p>
      )}
    </div>
  );
}

export function GuidedLayoutNotes({
  approved,
  form,
  setForm,
  busy,
  onSubmit,
}: {
  approved: boolean;
  form: PreferenceForm;
  setForm: Dispatch<SetStateAction<PreferenceForm>>;
  busy: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (approved) return null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <header className="border-b border-border px-6 py-4">
        <p className="text-sm font-bold text-foreground">Guided layout notes</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Send PMCM structured layout context for the official plan.</p>
      </header>
      <form onSubmit={onSubmit} className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup label="Preference title">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg" />
          </FieldGroup>
          <FieldGroup label="Guest count">
            <Input type="number" min={1} value={form.guestCount} onChange={(e) => setForm({ ...form, guestCount: Number(e.target.value) })} className="rounded-lg" />
          </FieldGroup>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup label="Seating style">
            <Input value={form.seatingStyle} onChange={(e) => setForm({ ...form, seatingStyle: e.target.value })} className="rounded-lg" />
          </FieldGroup>
          <FieldGroup label="Stage preference">
            <Input value={form.stagePreference} onChange={(e) => setForm({ ...form, stagePreference: e.target.value })} className="rounded-lg" />
          </FieldGroup>
        </div>
        <FieldGroup label="Guest flow notes">
          <textarea
            value={form.flowNotes}
            onChange={(e) => setForm({ ...form, flowNotes: e.target.value })}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </FieldGroup>
        <FieldGroup label="Constraints">
          <textarea
            value={form.constraints}
            onChange={(e) => setForm({ ...form, constraints: e.target.value })}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </FieldGroup>
        <Button disabled={busy === "layout-preference"} className="w-full rounded-lg font-bold" type="submit">
          <Send className="size-4" /> Save layout notes
        </Button>
      </form>
    </div>
  );
}
