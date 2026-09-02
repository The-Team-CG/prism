"use client";

import dynamic from "next/dynamic";
import { isPmcmAdmin } from "@/app/lib/role-guards";
import type { EventSession } from "@/app/lib/session";
import type { EventDashboardShellViewModel } from "../../view-models/use-event-dashboard-shell-view-model";

const EditorShell = dynamic(
  () => import("@/features/floorplan/editor").then((mod) => mod.EditorShell),
  {
    ssr: false,
    loading: () => (
      <div className="grid size-full place-items-center bg-background text-sm text-muted-foreground">
        Loading PMCM editor...
      </div>
    ),
  },
);

export function EventDashboardEditorScreen({
  session,
  screen,
  saveEditorPlan,
  submitEditorPlan,
  closeEditor,
}: {
  session: EventSession;
  screen: Extract<EventDashboardShellViewModel["screen"], { name: "editor" }>;
  saveEditorPlan: EventDashboardShellViewModel["saveEditorPlan"];
  submitEditorPlan: EventDashboardShellViewModel["submitEditorPlan"];
  closeEditor: EventDashboardShellViewModel["closeEditor"];
}) {
  return (
    <div className="h-screen w-full overflow-hidden">
      <EditorShell
        project={screen.project}
        eventName={screen.event.eventName}
        draftName={screen.draft.name}
        draftStatus={screen.draft.status}
        readOnly={!isPmcmAdmin(session.role)}
        onSave={saveEditorPlan}
        onSubmit={submitEditorPlan}
        onBack={closeEditor}
      />
    </div>
  );
}
