"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import { ArrowRight, MapPinned, MessageSquareText, Send } from "lucide-react";
import type { PrismEvent, PrismFloorPlanDraft } from "@prism/types";
import type { FloorPlanTemplate, Project } from "@/features/floorplan/editor";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { FieldGroup, LayoutPreview, formatStatusLabel } from "../../../workspace/shared";
import type { PreferenceForm } from "../../../workspace/shared";
import {
  canRequestFloorPlanRevision,
  floorPlanReviewHeadline,
  floorPlanRevisionComment,
} from "../../../workspace/model/client-floorplan-review-rules";

function templateSubtitle(template: FloorPlanTemplate) {
  return template.description || template.venue || "Saved PMCM floor plan template";
}

export function FloorPlanCardHeader({
  approved,
  isOfficial,
  activeDraft,
}: {
  approved: boolean;
  isOfficial: boolean;
  activeDraft?: PrismFloorPlanDraft;
}) {
  const title = approved ? "Official floorplan" : isOfficial ? "Official floorplan (read-only)" : "Layout preference";
  const description = approved
    ? "This official plan is locked after PMCM approval. You can view it; you cannot edit it."
    : isOfficial
      ? "PMCM owns this official layout. You can view the submitted plan. Layout preferences below do not change it."
      : "Share layout preferences. PMCM prepares the official floorplan from this context.";
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">Floor plan workspace</p>
        <h2 className="mt-1 text-xl font-black text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {activeDraft ? <StatusBadge status={activeDraft.status} label={formatStatusLabel(activeDraft.status)} /> : null}
    </header>
  );
}

export function FloorPlanDraftPanel({
  approved,
  isOfficial,
  activeDraft,
  officialProject,
  onOpenEditor,
}: {
  approved: boolean;
  isOfficial: boolean;
  activeDraft?: PrismFloorPlanDraft;
  officialProject: Project | null;
  onOpenEditor: (draft: PrismFloorPlanDraft, readOnly: boolean) => void;
}) {
  if (!activeDraft) {
    return <EmptyState icon={MapPinned} title="No floor plan draft yet" description="Start from a saved layout template or send guided notes below." />;
  }

  const readOnly = approved || isOfficial;
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 rounded-xl bg-muted/40 p-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{activeDraft.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {readOnly
              ? "Read-only official layout. Preference notes below do not mutate this plan."
              : "Open the preference editor to share seating, flow, and stage notes with PMCM."}
          </p>
        </div>
        <Button className="shrink-0 rounded-lg font-bold" onClick={() => onOpenEditor(activeDraft, readOnly)}>
          {readOnly ? "View official floorplan" : "Edit preference"} <ArrowRight className="size-4" />
        </Button>
      </div>
      <LayoutPreview project={approved || isOfficial ? officialProject : null} />
    </div>
  );
}

export function FloorPlanRevisionCommentCard({
  draft,
  event,
  value,
  setValue,
  busy,
  onSubmit,
}: {
  draft?: PrismFloorPlanDraft;
  event?: PrismEvent;
  value: string;
  setValue: (v: string) => void;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const editable = canRequestFloorPlanRevision(draft, event);
  const submittedComment = floorPlanRevisionComment(draft);
  if (draft?.status === "revision_requested" || (draft?.status === "in_review" && !editable && !submittedComment)) {
    return (
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <header className="border-b border-border px-6 py-4">
          <p className="text-sm font-bold text-foreground">Floorplan review</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{floorPlanReviewHeadline(draft)}</p>
        </header>
        <div className="space-y-3 p-6">
          {submittedComment ? (
            <div className="flex gap-3 rounded-xl bg-muted/40 p-4">
              <MessageSquareText className="size-5 shrink-0 text-(--prism-signal)" />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your revision comment</p>
                <p className="mt-1 text-sm text-foreground">{submittedComment}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">PMCM has not submitted a plan for your review yet.</p>
          )}
        </div>
      </div>
    );
  }
  if (!editable) return null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <header className="border-b border-border px-6 py-4">
        <p className="text-sm font-bold text-foreground">Review the official floorplan</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Open the plan above to inspect the submitted layout, then tell PMCM what to change.
        </p>
      </header>
      <form onSubmit={onSubmit} className="space-y-4 p-6">
        <FieldGroup label="Revision comment">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={4}
            placeholder="Describe the change you want, e.g. move the mingle space next to the bar."
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </FieldGroup>
        <Button disabled={busy} className="w-full rounded-lg font-bold" type="submit">
          <MessageSquareText className="size-4" /> Send revision comment
        </Button>
      </form>
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
