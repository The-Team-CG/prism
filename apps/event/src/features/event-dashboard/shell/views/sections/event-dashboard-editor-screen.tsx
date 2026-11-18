"use client";

import dynamic from "next/dynamic";
import type { EventSession } from "@/app/lib/session";
import type { EventDashboardShellViewModel } from "../../view-models/use-event-dashboard-shell-view-model";

function EditorLoading() {
  return (
    <div className="grid size-full place-items-center bg-background text-sm text-muted-foreground">
      Loading PMCM editor...
    </div>
  );
}

// The Pascal editor is several megabytes; it loads only when a draft is opened in it.
const PascalEditorShell = dynamic(() => import("@/features/floorplan/editor/PascalEditorShell").then((mod) => mod.PascalEditorShell), {
  ssr: false,
  loading: EditorLoading,
});

type EditorScreen = Extract<EventDashboardShellViewModel["screen"], { name: "editor" }>;

export function EventDashboardEditorScreen({
  session,
  screen,
  submitEditorScene,
  reloadEditor,
  closeEditor,
}: {
  session: EventSession;
  screen: EditorScreen;
  submitEditorScene: EventDashboardShellViewModel["submitEditorScene"];
  reloadEditor: EventDashboardShellViewModel["reloadEditor"];
  closeEditor: EventDashboardShellViewModel["closeEditor"];
}) {
  return (
    <div className="h-screen w-full overflow-hidden">
      <PascalEditorShell
        key={screen.openId}
        scene={screen.scene}
        guests={screen.seatingGuests}
        suppliers={screen.suppliers}
        pax={screen.pax}
        eventPrivacy={screen.eventPrivacy}
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
    </div>
  );
}
