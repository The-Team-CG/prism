"use client";

import dynamic from "next/dynamic";
import type { PrismEvent, PrismFloorPlanDraft } from "@prism/types";
import type { Project } from "@/features/floorplan/editor";
import {
  saveFloorPlanProject,
  submitFloorPlanEditorProject,
} from "../../use-cases/client-dashboard-actions";

const EditorShell = dynamic(
  () => import("@/features/floorplan/editor").then((mod) => mod.EditorShell),
  {
    ssr: false,
    loading: () => (
      <div className="grid size-full place-items-center bg-background text-sm text-muted-foreground">
        Loading layout view...
      </div>
    ),
  },
);

export function ClientFloorplanEditorScreen({
  event,
  draft,
  project,
  readOnly,
  onBack,
  onSubmitted,
}: {
  event: PrismEvent;
  draft: PrismFloorPlanDraft;
  project: Project;
  readOnly: boolean;
  onBack: () => void;
  onSubmitted: () => Promise<void>;
}) {
  const editable = !readOnly && draft.status !== "approved";

  async function handleSave(next: Project) {
    return saveFloorPlanProject(next);
  }

  async function handleSubmit(next: Project) {
    await submitFloorPlanEditorProject(event.id, draft, next);
    await onSubmitted();
  }

  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <EditorShell
        project={project}
        eventName={event.eventName}
        draftName={draft.name}
        draftStatus={draft.status}
        submitLabel={draft.sourceType === "client_preference" && draft.status === "revision_requested"
          ? "Return preference to PMCM"
          : undefined}
        readOnly={readOnly}
        onBack={onBack}
        onSave={editable ? handleSave : undefined}
        onSubmit={editable ? handleSubmit : undefined}
      />
    </main>
  );
}
