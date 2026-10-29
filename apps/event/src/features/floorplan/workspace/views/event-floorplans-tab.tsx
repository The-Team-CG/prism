import { useMemo, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import type { PrismEvent, PrismFloorPlanDraft } from "@prism/types";
import { formatPortalDateTime } from "@prism/ui/format-date";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import type { FloorPlanTemplate } from "@/features/floorplan/editor";
import { floorplanSourceLabel, roleLabel } from "@/features/pmcm-kit";
import { floorplanDraftActions, groupFloorplanDrafts } from "../model/floorplan-workspace-rules";
import { useFloorplanSnapshotHistoryViewModel } from "../view-models/use-floorplan-snapshot-history-view-model";

const EM_DASH = "—";

type DraftHandlers = {
  event: PrismEvent;
  drafts: PrismFloorPlanDraft[];
  onOpenDraft: (event: PrismEvent, draft: PrismFloorPlanDraft, readOnly?: boolean) => void | Promise<void>;
  onSubmitDraft: (draft: PrismFloorPlanDraft) => void | Promise<void>;
  onApproveDraft: (draft: PrismFloorPlanDraft) => void | Promise<void>;
  onReopenClientPreference?: (draft: PrismFloorPlanDraft) => void | Promise<void>;
};

/**
 * PMCM floorplan workspace. Leads with the authoritative approved official plan, then
 * drafts in progress, client preferences (never official), older versions, and finally
 * the controls for starting a new draft. Canvas internals stay in the editor package.
 */
export function EventFloorplansTab({
  floorPlanTemplates,
  onCreateTemplateDraft,
  onCreateBlankDraft,
  accessPanel,
  ...handlers
}: DraftHandlers & {
  floorPlanTemplates: FloorPlanTemplate[];
  onCreateTemplateDraft: (template: FloorPlanTemplate) => void | Promise<void>;
  /** Starts an empty official draft; always available, so a first plan never depends on a saved template. */
  onCreateBlankDraft?: () => void | Promise<void>;
  /** Optional slot for the client floorplan access controls owned by the dashboard shell. */
  accessPanel?: ReactNode;
}) {
  const groups = useMemo(() => groupFloorplanDrafts(handlers.drafts), [handlers.drafts]);

  return (
    <div className="space-y-4">
      <OfficialPlanSection draft={groups.official} pendingCount={groups.inProgress.length} handlers={handlers} />

      <WorkspaceSection id="floorplan-in-progress" title="Drafts in progress" count={groups.inProgress.length}>
        {groups.inProgress.length === 0 ? (
          <p className="text-sm text-muted-foreground">No PMCM drafts are waiting for submission or approval.</p>
        ) : (
          <ul>{groups.inProgress.map((draft) => <DraftRow key={draft.id} draft={draft} handlers={handlers} />)}</ul>
        )}
      </WorkspaceSection>

      <WorkspaceSection id="floorplan-client-preferences" title="Client preferences" count={groups.clientPreferences.length}>
        <p className="text-xs text-muted-foreground">Layout requests from the client. They inform the official plan but are never official themselves.</p>
        {groups.clientPreferences.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">The client has not submitted a layout preference.</p>
        ) : (
          <ul className="mt-1">{groups.clientPreferences.map((draft) => <DraftRow key={draft.id} draft={draft} handlers={handlers} />)}</ul>
        )}
      </WorkspaceSection>

      {groups.history.length > 0 ? (
        <details className="group rounded-lg border border-border bg-card px-4 py-3 sm:px-5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-base font-semibold text-foreground">
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
            Older versions
            <span className="text-sm font-normal tabular-nums text-muted-foreground">{groups.history.length}</span>
          </summary>
          <ul className="pt-1">{groups.history.map((draft) => <DraftRow key={draft.id} draft={draft} handlers={handlers} />)}</ul>
        </details>
      ) : null}

      <WorkspaceSection id="floorplan-start-draft" title="Start a PMCM draft">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {onCreateBlankDraft ? (
              <button
                type="button"
                onClick={() => void onCreateBlankDraft()}
                className="min-h-11 rounded-md border border-dashed border-primary/40 bg-background p-3 text-left hover:bg-primary-soft"
              >
                <span className="block text-sm font-semibold text-foreground">Blank layout</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">Empty room using the briefing's venue and guest count</span>
              </button>
            ) : null}
            {floorPlanTemplates.slice(0, onCreateBlankDraft ? 3 : 4).map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => void onCreateTemplateDraft(template)}
                className="min-h-11 rounded-md border border-border bg-background p-3 text-left hover:bg-muted"
              >
                <span className="block break-words text-sm font-semibold text-foreground">{template.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{template.description || template.venue || "Saved PMCM template"}</span>
              </button>
            ))}
          </div>
          {floorPlanTemplates.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No saved templates yet. In the editor, "Save current as template" makes a layout reusable for later events.</p>
          ) : null}
      </WorkspaceSection>

      {accessPanel}
    </div>
  );
}

function WorkspaceSection({ id, title, count, children }: { id: string; title: string; count?: number; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-border bg-card px-4 py-3 sm:px-5 sm:py-4">
      <h2 id={id} className="flex items-baseline gap-2 pb-2 text-base font-semibold text-foreground">
        {title}
        {typeof count === "number" ? <span className="text-sm font-normal tabular-nums text-muted-foreground">{count}</span> : null}
      </h2>
      {children}
    </section>
  );
}

function OfficialPlanSection({ draft, pendingCount, handlers }: { draft: PrismFloorPlanDraft | undefined; pendingCount: number; handlers: DraftHandlers }) {
  return (
    <section aria-labelledby="floorplan-official" className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <h2 id="floorplan-official" className="text-xl font-semibold text-foreground">Official floorplan</h2>
      {draft ? (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="min-w-0 break-words text-lg font-semibold text-foreground">{draft.name}</p>
            <StatusBadge status="approved" label="Approved official plan" />
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Fact label="Approved" value={draft.approvedSnapshotAt ?? draft.approvedAt ? formatPortalDateTime(draft.approvedSnapshotAt ?? draft.approvedAt) : null} />
            <Fact label="Reviewed" value={draft.reviewedAt ? formatPortalDateTime(draft.reviewedAt) : null} />
            <Fact label="Source" value={floorplanSourceLabel(draft.sourceType)} />
            <Fact label="Prepared by" value={draft.createdByRole ? roleLabel(draft.createdByRole) : null} />
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="min-h-11" onClick={() => void handlers.onOpenDraft(handlers.event, draft)}>Open official plan</Button>
          </div>
          <FloorplanSnapshotHistory eventId={handlers.event.id} draftId={draft.id} />
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          No official floorplan has been approved yet.
          {pendingCount > 0 ? ` ${pendingCount} PMCM draft${pendingCount === 1 ? " is" : "s are"} in progress below.` : " Start a PMCM draft from a saved template below."}
        </p>
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={value ? "text-foreground tabular-nums" : "text-muted-foreground"}>{value ?? EM_DASH}</dd>
    </div>
  );
}

function DraftRow({ draft, handlers }: { draft: PrismFloorPlanDraft; handlers: DraftHandlers }) {
  const updated = draft.updatedAt ?? draft.createdAt;
  return (
    <li className="grid gap-2 border-t border-border py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="min-w-0 break-words text-sm font-semibold text-foreground">{draft.name}</span>
          <StatusBadge status={draft.status} />
        </p>
        <p className="text-xs text-muted-foreground">
          {floorplanSourceLabel(draft.sourceType)} · {roleLabel(draft.createdByRole)}
          {updated ? ` · Updated ${formatPortalDateTime(updated)}` : ""}
        </p>
        {draft.clientPreference ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Seating: <span className="text-foreground">{draft.clientPreference.seatingStyle || EM_DASH}</span>
            {" · "}Stage: <span className="text-foreground">{draft.clientPreference.stagePreference || EM_DASH}</span>
          </p>
        ) : null}
        {draft.status === "revision_requested" && draft.revisionComment ? (
          <p className="mt-1 text-xs text-foreground"><span className="font-semibold text-attention">Revision requested:</span> {draft.revisionComment}</p>
        ) : null}
      </div>
      <DraftRowActions draft={draft} handlers={handlers} />
    </li>
  );
}

function DraftRowActions({ draft, handlers }: { draft: PrismFloorPlanDraft; handlers: DraftHandlers }) {
  const actions = floorplanDraftActions(draft, handlers.event.floorPlanStatus, handlers.drafts);
  const reopen = actions.canReopenPreference ? handlers.onReopenClientPreference : undefined;
  return (
    <div className="flex flex-wrap gap-2 sm:justify-end">
      {actions.canEdit ? (
        <Button size="sm" variant="outline" className="min-h-11" onClick={() => void handlers.onOpenDraft(handlers.event, draft)}>Open / Edit</Button>
      ) : null}
      {actions.canViewPreference ? (
        <Button size="sm" variant="outline" className="min-h-11" onClick={() => void handlers.onOpenDraft(handlers.event, draft, true)}>
          {draft.status === "approved" ? "View approved layout" : "View preference layout"}
        </Button>
      ) : null}
      {reopen ? (
        <Button size="sm" variant="outline" className="min-h-11" onClick={() => void reopen(draft)}>Reopen preference</Button>
      ) : null}
      {actions.canSubmit ? (
        <Button size="sm" className="min-h-11" onClick={() => void handlers.onSubmitDraft(draft)}>Submit</Button>
      ) : null}
      {actions.canApprove ? (
        <Button size="sm" className="min-h-11" onClick={() => void handlers.onApproveDraft(draft)}>Approve</Button>
      ) : null}
    </div>
  );
}

function FloorplanSnapshotHistory({ eventId, draftId }: { eventId: string; draftId: string }) {
  const [open, setOpen] = useState(false);
  const vm = useFloorplanSnapshotHistoryViewModel(eventId, draftId);

  return (
    <div className="mt-4 border-t border-border pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => { const next = !open; setOpen(next); if (next) void vm.load(); }}
        className="min-h-11 text-sm font-semibold text-primary"
      >
        {open ? "Hide snapshot history" : "View snapshot history"}
      </button>
      {open ? (
        <div className="mt-1 space-y-2" aria-live="polite">
          {vm.loading ? <p className="text-xs text-muted-foreground">Loading snapshots…</p> : null}
          {vm.error ? (
            <p role="alert" className="text-xs text-danger">
              {vm.error} <button type="button" className="font-semibold underline" onClick={() => void vm.load()}>Retry</button>
            </p>
          ) : null}
          {!vm.loading && !vm.error && vm.history.length === 0 ? <p className="text-xs text-muted-foreground">No historical snapshots have been recorded yet.</p> : null}
          <ul>
            {vm.history.map((version) => (
              <li key={version.id} className="border-t border-border py-2 text-xs first:border-t-0">
                <p className="font-semibold text-foreground">Round {version.round} · {version.snapshotType === "approved" ? "Official layout approved" : "Submitted for review"}</p>
                <p className="mt-0.5 text-muted-foreground">
                  {formatPortalDateTime(version.createdAt)} · {version.snapshot.venue || "Venue not set"} · <span className="tabular-nums">{version.snapshot.pax}</span> guests · <span className="tabular-nums">{version.snapshot.objects?.length ?? 0}</span> layout objects
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
