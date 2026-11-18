"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { acquireSceneReadOnlyLease, loadPlugin } from "@pascal-app/core";
import { Editor, getSavedSceneDocument, useCameraHintFocus, useEditor, type SaveStatus } from "@pascal-app/editor";
import { builtinPlugin } from "@pascal-app/nodes";
import type { FloorplanSceneDocument } from "@prism/types";
import { PrismFloorplanProvider, type PrismFloorplanContextValue } from "./editor-context";
import { prismEventLayoutPlugin } from "./event-layout-plugin";
import { PASCAL_VERSION, fromSceneDocument, toSceneDocument, type PascalSaveScene } from "./scene-document";
import { EditorFooter } from "./shell/editor-footer";
import { EditorHeader } from "./shell/editor-header";
import { LoadingRoom } from "./shell/loading-room";
import { LensOverlay } from "./shell/lens-overlay";
import { LensSwitch } from "./shell/lens-switch";
import { columnTab, railTabs } from "./shell/rail-tabs";
import { prismLens } from "./lens";
import { PiecePlacement } from "./tools/piece-placement";
import { hostState } from "./inspector/host-state";
import { SeatedGuestsFooter } from "./inspector/seated-guests-footer";
import { UnmatchedSeatsNotice } from "./shell/unmatched-seats-notice";

export type PrismFloorplanEditorProps = Omit<PrismFloorplanContextValue, "readOnly"> & {
  scene: FloorplanSceneDocument;
  readOnly: boolean;
  onSave(document: FloorplanSceneDocument): Promise<unknown>;
  onSubmit?(document: FloorplanSceneDocument): Promise<unknown>;
  onBack(): void;
  eventName?: string;
  draftName?: string;
  draftStatus?: string;
};

// Read by the Pascal chrome patch (patches/@pascal-app+editor+1.1.6.patch): PRISM hosts the editor, so Pascal hides
// its plugin manager, level chip, sky control, compass, shortcuts card, scans control and read-only action bars.
(globalThis as { __PRISM_HOST__?: boolean }).__PRISM_HOST__ = true;

let pluginsLoaded: Promise<void> | null = null;

/** Registers Pascal's built-in nodes and PRISM's event pieces once per page. */
function loadPlugins(): Promise<void> {
  pluginsLoaded ??= (async () => {
    await loadPlugin(builtinPlugin);
    await loadPlugin(prismEventLayoutPlugin);
  })();
  return pluginsLoaded;
}

/** The scene as a save writes it now, including edits the debounced autosave has not written yet. */
function currentDocument(): FloorplanSceneDocument {
  const { nodes, rootNodeIds, collections, materials, installedPlugins } = getSavedSceneDocument();
  return toSceneDocument({ nodes, rootNodeIds, collections, materials, installedPlugins }, PASCAL_VERSION);
}

/** Layouts are drawn at a desk; below this width the plan opens view-only. */
const SMALL_SCREEN = "(max-width: 767px)";

function subscribeSmallScreen(onChange: () => void) {
  const query = window.matchMedia(SMALL_SCREEN);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const useSmallScreen = () => useSyncExternalStore(subscribeSmallScreen, () => window.matchMedia(SMALL_SCREEN).matches, () => false);

function usePluginsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void loadPlugins().then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);
  return ready;
}

/**
 * The Pascal editor hosted for a PRISM floor plan. The scene always loads from and saves through the host, so
 * Pascal never keeps its own copy in the browser. A read-only session holds Pascal's read-only lease, which refuses
 * every scene change, and never calls `onSave`.
 */
export function PrismFloorplanEditor(props: PrismFloorplanEditorProps) {
  const { scene, onSave, onSubmit, onBack, eventName, draftName, draftStatus } = props;
  const { guests, suppliers, seating, guestCount, saveState, onRetrySave, onReload, unmatchedSeats } = props;
  const ready = usePluginsReady();
  const smallScreen = useSmallScreen();
  const readOnly = props.readOnly || smallScreen;
  const [pascalStatus, setPascalStatus] = useState<SaveStatus>("idle");
  // The editor reloads whenever `onLoad` changes, so it reads the scene it was opened with; reopen to reload.
  const [initialScene] = useState(scene);
  const onLoad = useCallback(async () => fromSceneDocument(initialScene), [initialScene]);
  const save = useCallback(
    async (saved: PascalSaveScene) => {
      if (readOnly) return;
      await onSave(toSceneDocument(saved, PASCAL_VERSION));
    },
    [onSave, readOnly],
  );
  const tabs = useMemo(() => railTabs(readOnly), [readOnly]);
  const context = useMemo<PrismFloorplanContextValue>(
    () => ({ readOnly, guests, suppliers, seating, guestCount, saveState, onRetrySave, onReload, unmatchedSeats }),
    [readOnly, guests, suppliers, seating, guestCount, saveState, onRetrySave, onReload, unmatchedSeats],
  );

  useEffect(() => (readOnly ? acquireSceneReadOnlyLease() : undefined), [readOnly]);
  // Pascal's camera tips card stays away; the controls are the usual pan, rotate and zoom.
  useEffect(() => useCameraHintFocus.getState().focus([]), []);
  // Every plan opens as laid out; Seating is gone when the event cannot seat guests.
  useEffect(() => prismLens.set("layout"), []);
  useEffect(() => hostState.setGuestsPanelOpener(() => useEditor.getState().setActiveSidebarPanel("guests")), []);
  useEffect(() => {
    if (!seating.allowed && prismLens.get() === "seating") prismLens.set("layout");
    hostState.setFacts({ seatingAllowed: seating.allowed, readOnly });
  }, [seating.allowed, readOnly]);

  const header = (
    <EditorHeader
      onBack={onBack}
      currentDocument={currentDocument}
      onSubmit={onSubmit}
      pascalStatus={pascalStatus}
      eventName={eventName}
      draftName={draftName}
      draftStatus={draftStatus}
    />
  );
  return (
    <PrismFloorplanProvider value={context}>
      <div className="prism-pascal-editor flex h-dvh w-full flex-col">
        {smallScreen && !props.readOnly ? (
          <p role="note" className="shrink-0 bg-muted px-4 py-2 text-center text-sm text-foreground">
            Edit on a laptop
          </p>
        ) : null}
        <div className="min-h-0 flex-1">
          {ready ? (
            <Editor
              layoutVersion="v2"
              projectId={null}
              sidebarTabs={tabs}
              columnTabId={columnTab(readOnly)}
              viewBar={false}
              navbarSlot={header}
              viewerToolbarLeft={<LensSwitch />}
              floorplanSceneSlot={<LensOverlay />}
              inspectorFooter={<SeatedGuestsFooter />}
              sceneOverlay={<UnmatchedSeatsNotice />}
              loadingSlot={<LoadingRoom />}
              onLoad={onLoad}
              onSave={save}
              onSaveStatusChange={setPascalStatus}
            />
          ) : (
            <div className="flex h-full flex-col">
              <div className="flex h-14 shrink-0 items-center border-b border-border px-3">{header}</div>
              <LoadingRoom />
            </div>
          )}
        </div>
        {ready ? <EditorFooter /> : null}
        {ready ? <PiecePlacement /> : null}
      </div>
    </PrismFloorplanProvider>
  );
}
