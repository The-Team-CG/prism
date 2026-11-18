"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { PASCAL_VERSION, PrismFloorplanEditor } from "@prism/floorplan-canvas/editor";
import type { FloorplanSceneDocument, PrismUserRole } from "@prism/types";
import { isFloorplanEditorReadOnly } from "./model/editor-engine";
import { openPlanScene, type PlanToOpen } from "./use-cases/open-plan-scene";
import type { SceneSaver } from "./use-cases/scene-saver";

export type PascalEditorShellProps = {
  plan: PlanToOpen;
  role: PrismUserRole;
  /** Submitted and approved drafts open read-only even for PMCM. */
  screenReadOnly: boolean;
  /** Autosaves the scene in order; its state drives the header's save status. */
  saver: SceneSaver;
  onSubmit(scene: FloorplanSceneDocument): Promise<unknown>;
  /** Opens the draft again from the stored plan after a conflict. */
  onReload(): void;
  onBack(): void;
  eventName?: string;
  draftName?: string;
  draftStatus?: string;
};

const ignoreSave = async () => undefined;
// Until the roster is loaded (guests task), the editor sees no guests and no seating.
const NO_SEATING = { allowed: false, reason: null };

/**
 * The Pascal floor plan editor for a draft. A plan saved by the legacy editor opens converted, and its first save
 * stores the scene. A read-only session gets no save or submit at all.
 */
export function PascalEditorShell({ plan, role, screenReadOnly, saver, onSubmit, onReload, onBack, eventName, draftName, draftStatus }: PascalEditorShellProps) {
  const readOnly = isFloorplanEditorReadOnly(screenReadOnly, role);
  const [{ scene }] = useState(() => openPlanScene(plan, PASCAL_VERSION));
  const save = useCallback((document: FloorplanSceneDocument) => saver.save(document), [saver]);
  const saveState = useSyncExternalStore(saver.subscribe, saver.state, saver.state);
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
      guests={[]}
      suppliers={[]}
      seating={NO_SEATING}
      guestCount={0}
      saveState={saveState}
      onRetrySave={retry}
      onReload={onReload}
      unmatchedSeats={0}
    />
  );
}
