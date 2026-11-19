"use client";

import { PrismFloorplanEditor } from "@prism/floorplan-canvas/editor";
import type { FloorplanSceneDocument } from "@prism/types";

const NONE: never[] = [];
const SEATING = { allowed: false, reason: "PMCM seats guests on the official layout." };
const ignore = async () => undefined;
const nothing = () => undefined;

/**
 * PMCM's official layout in the same Pascal editor PMCM drew it in, read-only: the client sees the plan exactly as it
 * was built (its 3D view and 2D presentation), with no save, submit or seating, and without PMCM's planning
 * aids (layout checks, capacity estimates, the guest list). Load it client-side
 * only (next/dynamic with ssr: false), since the editor needs the browser.
 */
export function OfficialLayoutViewer({ scene, eventName, draftName, draftStatus, onBack }: {
  scene: FloorplanSceneDocument;
  eventName: string;
  draftName: string;
  draftStatus: string;
  onBack: () => void;
}) {
  return (
    <PrismFloorplanEditor
      scene={scene}
      readOnly
      presentation
      onSave={ignore}
      onBack={onBack}
      eventName={eventName}
      draftName={draftName}
      draftStatus={draftStatus}
      guests={NONE}
      suppliers={NONE}
      seating={SEATING}
      guestCount={0}
      saveState="saved"
      onRetrySave={nothing}
      onReload={nothing}
    />
  );
}
