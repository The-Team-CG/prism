import type { FloorplanSceneDocument } from "@prism/types";

export type SavePlanScene = (planId: string, scene: FloorplanSceneDocument, expectedUpdatedAt: string) => Promise<{ updatedAt: string }>;

export type SceneSaver = {
  save(scene: FloorplanSceneDocument): Promise<void>;
  /** The plan version the last successful save returned. */
  updatedAt(): string;
};

/**
 * Saves the Pascal editor's scene one save at a time. The editor autosaves repeatedly, and each save must name the
 * version the previous one produced, so a save waits for the one before it and then sends that version. A failed save
 * is reported to its caller and leaves the version unchanged for the next one.
 */
export function createSceneSaver({ planId, updatedAt, save }: { planId: string; updatedAt: string; save: SavePlanScene }): SceneSaver {
  let version = updatedAt;
  let previous: Promise<unknown> = Promise.resolve();
  return {
    save(scene) {
      const next = previous.then(async () => {
        version = (await save(planId, scene, version)).updatedAt;
      });
      previous = next.catch(() => undefined);
      return next;
    },
    updatedAt: () => version,
  };
}
