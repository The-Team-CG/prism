import type { FloorplanSceneDocument, SceneSaveState } from "@prism/types";

export type SavePlanScene = (planId: string, scene: FloorplanSceneDocument, expectedUpdatedAt: string) => Promise<{ updatedAt: string }>;

export type SceneSaver = {
  save(scene: FloorplanSceneDocument): Promise<void>;
  /** Sends the latest unsaved scene again after a failed save; does nothing otherwise. */
  retry(): Promise<void>;
  state(): SceneSaveState;
  subscribe(listener: () => void): () => void;
  /** The plan version the last successful save returned. */
  updatedAt(): string;
};

/** The API answers 409 when the plan was saved elsewhere after this editor loaded it. */
const isConflict = (error: unknown) => typeof error === "object" && error !== null && (error as { status?: unknown }).status === 409;

/**
 * Saves the Pascal editor's scene one save at a time. The editor autosaves repeatedly, and each save must name the
 * version the previous one produced, so a save waits for the one before it and then sends that version. A failed save
 * is reported to its caller and leaves the version unchanged for the next one. After a conflict nothing more is sent:
 * the latest scene is kept until the plan is reloaded, so the version saved elsewhere is never overwritten.
 */
export function createSceneSaver({ planId, updatedAt, save }: { planId: string; updatedAt: string; save: SavePlanScene }): SceneSaver {
  let version = updatedAt;
  let previous: Promise<unknown> = Promise.resolve();
  let state: SceneSaveState = "saved";
  let unsaved: FloorplanSceneDocument | null = null;
  let inFlight = 0;
  const listeners = new Set<() => void>();
  const setState = (next: SceneSaveState) => {
    if (state === next) return;
    state = next;
    for (const listener of [...listeners]) listener();
  };

  async function sendInTurn(scene: FloorplanSceneDocument) {
    await previous.catch(() => undefined);
    if (state === "conflict") return;
    version = (await save(planId, scene, version)).updatedAt;
    if (unsaved === scene) unsaved = null;
  }

  function send(scene: FloorplanSceneDocument): Promise<void> {
    inFlight += 1;
    setState("saving");
    const sent = sendInTurn(scene);
    previous = sent;
    return sent.then(
      () => {
        inFlight -= 1;
        if (state !== "conflict") setState(inFlight === 0 ? "saved" : "saving");
      },
      (error: unknown) => {
        inFlight -= 1;
        if (state !== "conflict") setState(isConflict(error) ? "conflict" : "failed");
        throw error;
      },
    );
  }

  return {
    save(scene) {
      unsaved = scene;
      return state === "conflict" ? Promise.resolve() : send(scene);
    },
    retry() {
      if (state !== "failed" || !unsaved) return Promise.resolve();
      return send(unsaved).catch(() => undefined);
    },
    state: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    updatedAt: () => version,
  };
}
