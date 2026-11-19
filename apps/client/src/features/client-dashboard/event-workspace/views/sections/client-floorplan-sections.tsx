"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import { MapPinned, PencilRuler } from "lucide-react";
import type { PrismFloorPlanDraft } from "@prism/types";
import type { ClientPlanLayout } from "@/features/floorplan/snapshot-project";
import { drawingOfScene } from "@/features/floorplan/drawing-of-scene";
import { PlanDrawingView } from "@/features/floorplan/plan-drawing-view";
import { formatPortalDate } from "@prism/ui/format-date";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";
import { Textarea } from "@prism/ui/components/textarea";
import { PrismEmptyLine, PrismSection } from "@prism/ui/page-blocks";
import { ClientListRow } from "../../../shared/client-list-ui";
import { FieldGroup } from "../../../workspace/shared";
import type { PreferenceForm } from "../../../workspace/shared";
import { floorPlanRevisionComment, officialPlanStatusLine } from "../../../workspace/model/client-floorplan-review-rules";
import { canEditClientFloorPlanPreference } from "../../../workspace/model/client-floorplan-preference-rules";

type OpenDraft = (draft: PrismFloorPlanDraft, readOnly: boolean) => void;

const metres = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/**
 * The plan PMCM owns, first on the page: one heading with where it stands, the scene drawn to scale, and one button to
 * open it full screen. While a version waits for the client's review, the review panel below replaces the drawing.
 */
export function OfficialLayoutSection({ draft, layout, reviewing, onOpenEditor }: {
  draft?: PrismFloorPlanDraft;
  layout: ClientPlanLayout | null;
  reviewing: boolean;
  onOpenEditor: OpenDraft;
}) {
  if (!draft) {
    return (
      <PrismSection id="client-official-floorplan" title="Official layout" headerOutside>
        <PrismEmptyLine icon={MapPinned}>
          PMCM draws the official layout from your ideas and shares it here for you to review.
        </PrismEmptyLine>
      </PrismSection>
    );
  }
  const comment = draft.status === "revision_requested" ? floorPlanRevisionComment(draft) : null;
  const drawing = layout ? drawingOfScene(layout.scene) : null;
  return (
    <PrismSection
      id="client-official-floorplan"
      title="Official layout"
      description={<>{officialPlanStatusLine(draft)}{comment ? <> Your note: &ldquo;{comment}&rdquo;</> : null}</>}
      headerOutside
      flush
      /* While the client reviews, the review panel below carries the plan, so this heading has no surface of its own. */
      bare={reviewing}
      action={reviewing ? undefined : <Button type="button" onClick={() => onOpenEditor(draft, true)}>Open layout</Button>}
    >
      {reviewing ? null : !layout ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">Loading the layout…</p>
      ) : drawing ? (
        <figure>
          <div className="grid place-items-center bg-surface-raised p-4">
            <PlanDrawingView drawing={drawing} label={`Official layout: ${layout.name}`} className="max-h-[34rem] w-full" />
          </div>
          <figcaption className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            {draft.name} · {metres(drawing.room.width)} × {metres(drawing.room.depth)} m
          </figcaption>
        </figure>
      ) : (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">PMCM has shared this layout; its room appears here once it has walls.</p>
      )}
    </PrismSection>
  );
}

function ideaStatus(draft: PrismFloorPlanDraft) {
  if (draft.status === "revision_requested") return { status: "PMCM asked for changes", tone: "attention" as const };
  if (draft.status === "approved") return { status: "Used by PMCM", tone: "done" as const };
  return { status: "Sent to PMCM", tone: "neutral" as const };
}

/** The client's own layout ideas as rows; each opens in the layout editor, editable only while PMCM has reopened it. */
export function LayoutIdeasSection({ drafts, approved, onOpenEditor }: {
  drafts: PrismFloorPlanDraft[];
  approved: boolean;
  onOpenEditor: OpenDraft;
}) {
  const ideas = drafts.filter((draft) => draft.sourceType === "client_preference");
  if (ideas.length === 0) return null;
  return (
    <PrismSection
      id="client-layout-ideas"
      title="Your layout ideas"
      description={approved ? "The official layout is approved, so these are kept for reference." : undefined}
      headerOutside
      flush
    >
      <ul className="divide-y divide-border">
        {ideas.map((draft) => {
          const editable = !approved && canEditClientFloorPlanPreference(draft);
          const { status, tone } = ideaStatus(draft);
          return (
            <ClientListRow
              key={draft.id}
              icon={PencilRuler}
              tone={editable ? "attention" : "neutral"}
              title={draft.name}
              meta={draft.revisionComment ? `PMCM: ${draft.revisionComment}` : `Sent ${formatPortalDate(draft.submittedAt ?? draft.updatedAt)}`}
              status={status}
              statusTone={tone}
              action={editable ? "Edit layout" : "View"}
              onOpen={() => onOpenEditor(draft, !editable)}
            />
          );
        })}
      </ul>
    </PrismSection>
  );
}

export function GuidedLayoutNotes({
  approved,
  preferenceDraft,
  form,
  setForm,
  busy,
  onSubmit,
}: {
  approved: boolean;
  preferenceDraft?: PrismFloorPlanDraft;
  form: PreferenceForm;
  setForm: Dispatch<SetStateAction<PreferenceForm>>;
  busy: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  // Once sent, the ideas row says where they stand; the form returns only when PMCM reopens them.
  if (approved || !canEditClientFloorPlanPreference(preferenceDraft)) return null;

  return (
    <PrismSection
      id="client-layout-notes"
      title={preferenceDraft ? "Update your layout notes" : "Describe your layout"}
      description={preferenceDraft ? "PMCM reopened your ideas. Change what you need and send them back." : "No drawing needed: tell PMCM how you picture the room, and draw it in the layout editor afterwards if you like."}
      headerOutside
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup label="Name for these ideas">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FieldGroup>
          <FieldGroup label="Guest count">
            <Input type="number" min={1} value={form.guestCount} onChange={(e) => setForm({ ...form, guestCount: Number(e.target.value) })} />
          </FieldGroup>
          <FieldGroup label="Seating style">
            <Input value={form.seatingStyle} onChange={(e) => setForm({ ...form, seatingStyle: e.target.value })} placeholder="Round tables of 10" />
          </FieldGroup>
          <FieldGroup label="Stage">
            <Input value={form.stagePreference} onChange={(e) => setForm({ ...form, stagePreference: e.target.value })} placeholder="Against the north wall" />
          </FieldGroup>
        </div>
        <FieldGroup label="How guests move through the room">
          <Textarea value={form.flowNotes} onChange={(e) => setForm({ ...form, flowNotes: e.target.value })} rows={3} />
        </FieldGroup>
        <FieldGroup label="Anything PMCM must work around (one per line)">
          <Textarea value={form.constraints} onChange={(e) => setForm({ ...form, constraints: e.target.value })} rows={3} />
        </FieldGroup>
        <div className="flex justify-end">
          <Button disabled={busy === "layout-preference"} type="submit">
            {busy === "layout-preference" ? "Sending…" : preferenceDraft ? "Send updated notes" : "Send to PMCM"}
          </Button>
        </div>
      </form>
    </PrismSection>
  );
}
