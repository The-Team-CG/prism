"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { PASCAL_VERSION, PrismFloorplanEditor } from "@prism/floorplan-canvas/editor";
import type { FloorplanSceneDocument } from "@prism/types";
import type { PreferencePlan } from "../data/preference-plan-repository";
import { openingScene } from "../use-cases/open-preference-scene";
import type { SceneSaver } from "../use-cases/scene-saver";

export type PreferenceEditorShellProps = {
  plan: PreferencePlan;
  officialScene: FloorplanSceneDocument | null;
  readOnly: boolean;
  guestCount: number;
  saver: SceneSaver;
  eventName: string;
  draftName: string;
  draftStatus: string;
  /** Sends the preference to PMCM with the scene as it stands, including edits autosave has not written yet. */
  onSubmit(scene: FloorplanSceneDocument): Promise<unknown>;
  onReload(): void;
  onBack(): void;
};

/** The client's own preference: no guests and no suppliers, since the event team seats guests on the official layout. */
const NO_GUESTS: never[] = [];
const SEATING = { allowed: false, reason: "Your event team seats guests on the official layout." };
const ignoreSave = async () => undefined;

/** The client's layout preference in the Pascal editor. Read-only sessions get no save or submit at all. */
export function PreferenceEditorShell(props: PreferenceEditorShellProps) {
  const { plan, officialScene, readOnly, guestCount, saver, eventName, draftName, draftStatus, onSubmit, onReload, onBack } = props;
  const [scene] = useState(() => openingScene(plan, officialScene, PASCAL_VERSION));
  const saveState = useSyncExternalStore(saver.subscribe, saver.state, saver.state);
  const saveMessage = useSyncExternalStore(saver.subscribe, saver.error, saver.error);
  const save = useCallback((document: FloorplanSceneDocument) => saver.save(document), [saver]);
  const retry = useCallback(() => void saver.retry(), [saver]);

  return (
    <PrismFloorplanEditor
      scene={scene}
      readOnly={readOnly}
      onSave={readOnly ? ignoreSave : save}
      onSubmit={readOnly ? undefined : onSubmit}
      onBack={onBack}
      eventName={eventName}
      draftName={draftName}
      draftStatus={draftStatus}
      submitLabel="Return preference to PMCM"
      guests={NO_GUESTS}
      suppliers={NO_GUESTS}
      seating={SEATING}
      guestCount={guestCount}
      saveState={saveState}
      saveMessage={saveMessage}
      onRetrySave={retry}
      onReload={onReload}
      unmatchedSeats={0}
    />
  );
}
