"use client";

import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { ChevronLeft, Send } from "lucide-react";
import { acquireSceneReadOnlyLease, loadPlugin } from "@pascal-app/core";
import { Editor, getSavedSceneDocument } from "@pascal-app/editor";
import { builtinPlugin } from "@pascal-app/nodes";
import type { FloorplanSceneDocument } from "@prism/types";
import { prismEventLayoutPlugin } from "./event-layout-plugin";
import { PASCAL_VERSION, fromSceneDocument, toSceneDocument, type PascalSaveScene } from "./scene-document";

export type PrismFloorplanEditorProps = {
  scene: FloorplanSceneDocument;
  readOnly: boolean;
  onSave(document: FloorplanSceneDocument): Promise<unknown>;
  onSubmit?(document: FloorplanSceneDocument): Promise<unknown>;
  onBack(): void;
  eventName?: string;
  draftName?: string;
  draftStatus?: string;
};

type SidebarTabs = NonNullable<ComponentProps<typeof Editor>["sidebarTabs"]>;

/** Pascal's own Scene tab; milestone 2 adds Room, Library, Guests and Checks beside it. */
const SIDEBAR_TABS: SidebarTabs = [
  {
    id: "site",
    label: "Scene",
    component: () => null,
    icon: <img alt="" src="/icons/scene.webp" width={32} height={32} />,
  },
];

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
function currentScene(): PascalSaveScene {
  const { nodes, rootNodeIds, collections, materials, installedPlugins } = getSavedSceneDocument();
  return { nodes, rootNodeIds, collections, materials, installedPlugins };
}

function EditorHeader({ readOnly, onBack, onSubmit, eventName, draftName, draftStatus }: Omit<PrismFloorplanEditorProps, "scene" | "onSave">) {
  const [submitting, setSubmitting] = useState(false);
  const submit = useCallback(async () => {
    if (!onSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(toSceneDocument(currentScene(), PASCAL_VERSION));
    } finally {
      setSubmitting(false);
    }
  }, [onSubmit]);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-foreground hover:bg-muted">
        <ChevronLeft className="size-4" aria-hidden />
        Back
      </button>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{draftName ?? "Floor plan"}</p>
        <p className="truncate text-xs text-muted-foreground">{[eventName, draftStatus, readOnly ? "View only" : null].filter(Boolean).join(" · ")}</p>
      </div>
      {onSubmit && !readOnly ? (
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          <Send className="size-4" aria-hidden />
          {submitting ? "Submitting…" : "Submit for review"}
        </button>
      ) : null}
    </div>
  );
}

/**
 * The Pascal editor hosted for a PRISM floor plan. The scene always loads from and saves through the host, so
 * Pascal never keeps its own copy in the browser. A read-only session holds Pascal's read-only lease, which refuses
 * every scene change, and never calls `onSave`.
 */
export function PrismFloorplanEditor({ scene, readOnly, onSave, ...header }: PrismFloorplanEditorProps) {
  const [ready, setReady] = useState(false);
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

  useEffect(() => {
    let active = true;
    void loadPlugins().then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => (readOnly ? acquireSceneReadOnlyLease() : undefined), [readOnly]);

  if (!ready) return <div className="p-6 text-sm text-muted-foreground">Loading the floor plan editor…</div>;
  return (
    <div className="prism-pascal-editor h-dvh w-full">
      <Editor
        layoutVersion="v2"
        projectId={null}
        sidebarTabs={SIDEBAR_TABS}
        navbarSlot={<EditorHeader readOnly={readOnly} {...header} />}
        onLoad={onLoad}
        onSave={save}
      />
    </div>
  );
}
