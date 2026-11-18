"use client";

import { useCallback, useState } from "react";
import { PASCAL_VERSION, PrismFloorplanEditor } from "@prism/floorplan-canvas/editor";
import type { FloorplanSceneDocument, PrismUserRole } from "@prism/types";
import { isFloorplanEditorReadOnly } from "./model/editor-engine";
import { openPlanScene, type PlanToOpen } from "./use-cases/open-plan-scene";

export type PascalEditorShellProps = {
  plan: PlanToOpen;
  role: PrismUserRole;
  /** Submitted and approved drafts open read-only even for PMCM. */
  screenReadOnly: boolean;
  onSave(scene: FloorplanSceneDocument): Promise<unknown>;
  onSubmit(scene: FloorplanSceneDocument): Promise<unknown>;
  onBack(): void;
  eventName?: string;
  draftName?: string;
  draftStatus?: string;
};

const ignoreSave = async () => undefined;
// Until the saver reports its state (save-queue task) and the roster is loaded (guests task), the editor sees an
// always-saved plan with no guests and no seating.
const NO_SEATING = { allowed: false, reason: null };
const nothing = () => undefined;

/**
 * The Pascal floor plan editor for a draft. A plan saved by the legacy editor opens converted, and its first save
 * stores the scene. A read-only session gets no save or submit at all.
 */
export function PascalEditorShell({ plan, role, screenReadOnly, onSave, onSubmit, onBack, eventName, draftName, draftStatus }: PascalEditorShellProps) {
  const readOnly = isFloorplanEditorReadOnly(screenReadOnly, role);
  const [{ scene }] = useState(() => openPlanScene(plan, PASCAL_VERSION));
  const save = useCallback((document: FloorplanSceneDocument) => onSave(document), [onSave]);

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
      saveState="saved"
      onRetrySave={nothing}
      onReload={nothing}
      unmatchedSeats={0}
    />
  );
}
