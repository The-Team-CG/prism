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
  submitEditorScene,
  reloadEditor,
  closeEditor,
}: {
  session: EventSession;
  screen: EditorScreen;
  saveEditorPlan: EventDashboardShellViewModel["saveEditorPlan"];
  submitEditorPlan: EventDashboardShellViewModel["submitEditorPlan"];
  submitEditorScene: EventDashboardShellViewModel["submitEditorScene"];
  reloadEditor: EventDashboardShellViewModel["reloadEditor"];
  closeEditor: EventDashboardShellViewModel["closeEditor"];
}) {
  return (
    <div className="h-screen w-full overflow-hidden">
      {screen.saver ? (
        <PascalEditorShell
          key={screen.openId}
          plan={{ scene: screen.scene, name: screen.project.name, widthM: screen.project.widthM, heightM: screen.project.heightM, objects: screen.project.objects, guests: screen.project.guests }}
          guests={screen.seatingGuests}
          suppliers={screen.suppliers}
          pax={screen.project.pax}
          eventPrivacy={screen.project.eventPrivacy}
          role={session.role}
          screenReadOnly={screen.readOnly}
          eventName={screen.event.eventName}
          draftName={screen.draft.name}
          draftStatus={screen.draft.status}
          saver={screen.saver}
          onSubmit={submitEditorScene}
          onReload={() => void reloadEditor()}
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
