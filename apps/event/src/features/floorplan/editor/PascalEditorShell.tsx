"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { PrismFloorplanEditor } from "@prism/floorplan-canvas/editor";
import type { FloorplanSceneDocument, PrismEventPrivacy, PrismFloorplanSeatingGuest, PrismFloorplanSupplier, PrismUserRole } from "@prism/types";
import { isFloorplanEditorReadOnly } from "./model/editor-access";
import { seatingFor } from "./model/seating";
import type { SceneSaver } from "./use-cases/scene-saver";
import { addTemplate } from "./data/templates-repository";

export type PascalEditorShellProps = {
  /** The stored scene the editor opens. */
  scene: FloorplanSceneDocument;
  role: PrismUserRole;
  /** Submitted and approved drafts open read-only even for PMCM. */
  screenReadOnly: boolean;
  /** The event's guest roster, seated by id, and the suppliers booked on the event. */
  guests: PrismFloorplanSeatingGuest[];
  suppliers: PrismFloorplanSupplier[];
  /** The event's guest count and privacy, which decide whether guests can be seated. */
  pax: number;
  eventPrivacy: PrismEventPrivacy | undefined;
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

/**
 * The Pascal floor plan editor for a draft, opened on its stored scene. A read-only session gets no save or submit at all.
 */
export function PascalEditorShell(props: PascalEditorShellProps) {
  const { scene: storedScene, role, screenReadOnly, guests, suppliers, pax, eventPrivacy, saver, onSubmit, onReload, onBack, eventName, draftName, draftStatus } = props;
  const readOnly = isFloorplanEditorReadOnly(screenReadOnly, role);
  const [scene] = useState(() => storedScene);
  const seating = useMemo(() => seatingFor(pax, eventPrivacy), [pax, eventPrivacy]);
  const save = useCallback((document: FloorplanSceneDocument) => saver.save(document), [saver]);
  /** The venue library keeps the scene under the venue's name, so a later draft starts from this room. */
  const saveTemplate = useCallback((document: FloorplanSceneDocument, name: string) => addTemplate({ name, venue: name, pax, scene: document }), [pax]);
  const saveState = useSyncExternalStore(saver.subscribe, saver.state, saver.state);
  const saveMessage = useSyncExternalStore(saver.subscribe, saver.error, saver.error);
  const retry = useCallback(() => void saver.retry(), [saver]);

  return (
    <PrismFloorplanEditor
      scene={scene}
      readOnly={readOnly}
      onSave={readOnly ? ignoreSave : save}
      onSubmit={readOnly ? undefined : onSubmit}
      onSaveTemplate={readOnly ? undefined : saveTemplate}
      onBack={onBack}
      eventName={eventName}
      draftName={draftName}
      draftStatus={draftStatus}
      guests={guests}
      suppliers={suppliers}
      seating={seating}
      guestCount={pax}
      saveState={saveState}
      saveMessage={saveMessage}
      onRetrySave={retry}
      onReload={onReload}
    />
  );
}
