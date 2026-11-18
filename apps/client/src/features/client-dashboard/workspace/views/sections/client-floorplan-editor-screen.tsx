"use client";

import dynamic from "next/dynamic";
import type { FloorplanSceneDocument, PrismEvent, PrismFloorPlanDraft } from "@prism/types";
import type { PreferencePlan } from "@/features/floorplan/preference-editor/data/preference-plan-repository";
import type { SceneSaver } from "@/features/floorplan/preference-editor/use-cases/scene-saver";

const PreferenceEditorShell = dynamic(
  () => import("@/features/floorplan/preference-editor/views/preference-editor-shell").then((mod) => mod.PreferenceEditorShell),
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
  plan,
  officialScene,
  readOnly,
  saver,
  openId,
  onBack,
  onReload,
  onSubmit,
}: {
  event: PrismEvent;
  draft: PrismFloorPlanDraft;
  plan: PreferencePlan;
  officialScene: FloorplanSceneDocument | null;
  readOnly: boolean;
  saver: SceneSaver;
  /** Changes on every open, so a reload mounts the editor again from the stored plan. */
  openId: number;
  onBack: () => void;
  onReload: () => void;
  onSubmit: (scene: FloorplanSceneDocument) => Promise<void>;
}) {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <PreferenceEditorShell
        key={openId}
        plan={plan}
        officialScene={officialScene}
        readOnly={readOnly}
        guestCount={draft.clientPreference?.guestCount ?? 0}
        saver={saver}
        eventName={event.eventName}
        draftName={draft.name}
        draftStatus={draft.status}
        onSubmit={onSubmit}
        onReload={onReload}
        onBack={onBack}
      />
    </main>
  );
}
