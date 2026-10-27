import { LayoutGrid, MapPinned } from "lucide-react";

import type { PrismEvent, PrismFloorPlanDraft } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { StatusBadge } from "@/app/components/ui/status-badge";
import type { FloorPlanTemplate } from "@/features/floorplan/editor";
import { label } from "@/features/pmcm-kit";
import { Panel } from "@/features/pmcm-kit";
import {
  canApproveFloorPlanDraft,
  canSubmitFloorPlanDraft,
} from "../model/floorplan-workspace-rules";

export function EventFloorplansTab({
  event,
  drafts,
  floorPlanTemplates,
  onCreateTemplateDraft,
  onOpenDraft,
  onSubmitDraft,
  onApproveDraft,
}: {
  event: PrismEvent;
  drafts: PrismFloorPlanDraft[];
  floorPlanTemplates: FloorPlanTemplate[];
  onCreateTemplateDraft: (template: FloorPlanTemplate) => Promise<void>;
  onOpenDraft: (event: PrismEvent, draft: PrismFloorPlanDraft) => Promise<void>;
  onSubmitDraft: (draft: PrismFloorPlanDraft) => Promise<void>;
  onApproveDraft: (draft: PrismFloorPlanDraft) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <Panel title="Start PMCM draft" icon={MapPinned}>
        {floorPlanTemplates.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {floorPlanTemplates.slice(0, 4).map((template) => (
              <button
                key={template.id}
                onClick={() => onCreateTemplateDraft(template)}
                className="rounded-xl border border-border bg-secondary/60 p-4 text-left transition hover:border-primary/35 hover:bg-secondary"
              >
                <p className="text-sm font-bold text-foreground">{template.name}</p>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  {template.description || template.venue || "Saved PMCM template"}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-secondary/40 p-4 text-xs text-muted-foreground">
            No saved templates yet. Save reusable layouts from the editor before starting a template-based draft.
          </p>
        )}
      </Panel>

      <Panel title="Floorplan drafts and client preferences" icon={LayoutGrid}>
        {drafts.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title="No floorplan drafts yet"
            description="Pick a saved template above to create the first PMCM draft for this event."
          />
        ) : (
          <div className="grid gap-3 xl:grid-cols-3">
            {drafts.map((draft) => (
              <div key={draft.id} className="rounded-xl border border-border bg-secondary/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{draft.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {label(draft.sourceType)} - {draft.createdByRole ?? "pmcm-admin"}
                    </p>
                  </div>
                  <StatusBadge status={draft.status} />
                </div>
                {draft.clientPreference && (
                  <div className="mt-3 rounded-lg border border-border bg-card p-3 text-xs leading-5 text-muted-foreground">
                    <p>
                      <span className="font-bold text-foreground">Seating:</span> {draft.clientPreference.seatingStyle}
                    </p>
                    <p>
                      <span className="font-bold text-foreground">Stage:</span> {draft.clientPreference.stagePreference}
                    </p>
                  </div>
                )}
                {draft.status === "revision_requested" && draft.revisionComment && (
                  <div className="mt-3 rounded-lg border border-attention/25 bg-attention/8 p-3 text-xs leading-5 text-foreground">
                    <p className="font-bold text-attention">Client revision requested</p>
                    <p className="mt-1 text-muted-foreground">{draft.revisionComment}</p>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg font-bold"
                    onClick={() => onOpenDraft(event, draft)}
                  >
                    Open/Edit
                  </Button>
                  {canSubmitFloorPlanDraft(draft.status) && (
                    <Button size="sm" className="rounded-lg font-bold" onClick={() => onSubmitDraft(draft)}>
                      Submit
                    </Button>
                  )}
                  {canApproveFloorPlanDraft(draft.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg border-success/25 bg-success/8 font-bold text-success hover:bg-success/12"
                      onClick={() => onApproveDraft(draft)}
                    >
                      Approve
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
