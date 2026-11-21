"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useIsMobile } from "@prism/ui";
import { LargerScreenNotice } from "@prism/ui/portal-status-pages";
import type { EventSession } from "@/app/lib/session";
import { draftStatusLabel } from "@/features/floorplan/editor/model/editor-access";
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
  const phone = useIsMobile();
  // The screen size is known only after the first render; waiting for it keeps a phone from loading the editor.
  const [measured, setMeasured] = useState(false);
  useEffect(() => setMeasured(true), []);
  if (!measured) return <div className="h-screen w-full"><EditorLoading /></div>;
  if (phone) {
    return (
      <LargerScreenNotice
        title="Open the floor plan on a larger screen"
        description={`The editor for ${screen.draft.name} needs a tablet or a computer. Everything else in this event works here.`}
        backLabel="Back to the event"
        onBack={closeEditor}
      />
    );
  }
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
        draftStatus={draftStatusLabel(screen.draft.status)}
        saver={screen.saver}
        onSubmit={submitEditorScene}
        onReload={() => void reloadEditor()}
        onBack={closeEditor}
      />
    </div>
  );
}
