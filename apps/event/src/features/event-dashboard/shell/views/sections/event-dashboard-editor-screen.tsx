"use client";

import dynamic from "next/dynamic";
import { isFloorplanEditorReadOnly } from "@/features/floorplan/editor/model/editor-engine";
import type { EventSession } from "@/app/lib/session";
import type { EventDashboardShellViewModel } from "../../view-models/use-event-dashboard-shell-view-model";

function EditorLoading() {
  return (
    <div className="grid size-full place-items-center bg-background text-sm text-muted-foreground">
      Loading PMCM editor...
    </div>
  );
}

const EditorShell = dynamic(() => import("@/features/floorplan/editor").then((mod) => mod.EditorShell), {
  ssr: false,
  loading: EditorLoading,
});

// The Pascal editor is several megabytes; it loads only when a draft is opened in it.
const PascalEditorShell = dynamic(() => import("@/features/floorplan/editor/PascalEditorShell").then((mod) => mod.PascalEditorShell), {
  ssr: false,
  loading: EditorLoading,
});

type EditorScreen = Extract<EventDashboardShellViewModel["screen"], { name: "editor" }>;

export function EventDashboardEditorScreen({
  session,
  screen,
  saveEditorPlan,
  submitEditorPlan,
  saveEditorScene,
  submitEditorScene,
  closeEditor,
}: {
  session: EventSession;
  screen: EditorScreen;
  saveEditorPlan: EventDashboardShellViewModel["saveEditorPlan"];
  submitEditorPlan: EventDashboardShellViewModel["submitEditorPlan"];
  saveEditorScene: EventDashboardShellViewModel["saveEditorScene"];
  submitEditorScene: EventDashboardShellViewModel["submitEditorScene"];
  closeEditor: EventDashboardShellViewModel["closeEditor"];
}) {
  return (
    <div className="h-screen w-full overflow-hidden">
      {screen.engine === "pascal" ? (
        <PascalEditorShell
          plan={{ scene: screen.scene, name: screen.project.name, widthM: screen.project.widthM, heightM: screen.project.heightM, objects: screen.project.objects }}
          role={session.role}
          screenReadOnly={screen.readOnly}
          eventName={screen.event.eventName}
          draftName={screen.draft.name}
          draftStatus={screen.draft.status}
          onSave={saveEditorScene}
          onSubmit={submitEditorScene}
          onBack={closeEditor}
        />
      ) : (
        <EditorShell
          project={screen.project}
          eventName={screen.event.eventName}
          draftName={screen.draft.name}
          draftStatus={screen.draft.status}
          readOnly={isFloorplanEditorReadOnly(screen.readOnly, session.role)}
          onSave={saveEditorPlan}
          onSubmit={submitEditorPlan}
          onBack={closeEditor}
        />
      )}
    </div>
  );
}
