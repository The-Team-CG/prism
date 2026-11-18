import { describe, expect, it, vi } from "vitest";
import type { FloorplanSceneDocument } from "@prism/types";
import { createSceneSaver } from "./scene-saver";

const scene: FloorplanSceneDocument = { format: "pascal-v1", pascalVersion: "1.1.6", nodes: {}, rootNodeIds: [] };

/** A plan store that refuses a save made against any version but its latest, as the API does with 409. */
function planStore(initialUpdatedAt: string) {
  let current = initialUpdatedAt;
  let saves = 0;
  const save = vi.fn(async (_planId: string, _scene: FloorplanSceneDocument, expectedUpdatedAt: string) => {
    await Promise.resolve();
    if (expectedUpdatedAt !== current) throw new Error("409 Floorplan changed since it was loaded");
    saves += 1;
    current = new Date(Date.UTC(2026, 10, 19, 0, 0, saves)).toISOString();
    return { updatedAt: current };
  });
  return { save, latest: () => current };
}

describe("createSceneSaver", () => {
  it("sends each autosave against the version the previous save returned, so back-to-back saves never conflict", async () => {
    const store = planStore("2026-11-19T00:00:00.000Z");
    const saver = createSceneSaver({ planId: "plan_1", updatedAt: "2026-11-19T00:00:00.000Z", save: store.save });

    await Promise.all([saver.save(scene), saver.save(scene), saver.save(scene)]);

    expect(store.save).toHaveBeenCalledTimes(3);
    expect(store.save.mock.calls.map(([, , expected]) => expected)).toEqual([
      "2026-11-19T00:00:00.000Z",
      "2026-11-19T00:00:01.000Z",
      "2026-11-19T00:00:02.000Z",
    ]);
    expect(saver.updatedAt()).toBe(store.latest());
  });

  it("reports a failed save and still saves the next one", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ updatedAt: "2026-11-19T00:00:05.000Z" });
    const saver = createSceneSaver({ planId: "plan_1", updatedAt: "2026-11-19T00:00:00.000Z", save });

    await expect(saver.save(scene)).rejects.toThrow("offline");
    await expect(saver.save(scene)).resolves.toBeUndefined();
    expect(save).toHaveBeenLastCalledWith("plan_1", scene, "2026-11-19T00:00:00.000Z");
    expect(saver.updatedAt()).toBe("2026-11-19T00:00:05.000Z");
  });

  it("sends nothing after a 409 and stays in conflict, so the plan saved elsewhere is never overwritten", async () => {
    const conflict = Object.assign(new Error("Floorplan changed since it was loaded"), { status: 409 });
    const save = vi.fn().mockRejectedValueOnce(conflict);
    const saver = createSceneSaver({ planId: "plan_1", updatedAt: "2026-11-19T00:00:00.000Z", save });

    await expect(saver.save(scene)).rejects.toThrow("changed since");
    await expect(saver.save({ ...scene, rootNodeIds: ["later"] })).resolves.toBeUndefined();
    await saver.retry();

    expect(save).toHaveBeenCalledTimes(1);
    expect(saver.state()).toBe("conflict");
  });

  it("retries a failure with the latest scene, not the one that failed", async () => {
    const first = { ...scene, rootNodeIds: ["first"] };
    const latest = { ...scene, rootNodeIds: ["latest"] };
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ updatedAt: "2026-11-19T00:00:05.000Z" });
    const saver = createSceneSaver({ planId: "plan_1", updatedAt: "2026-11-19T00:00:00.000Z", save });

    await Promise.allSettled([saver.save(first), saver.save(latest)]);
    expect([saver.state(), saver.error()]).toEqual(["failed", "offline"]);
    await saver.retry();

    expect(save).toHaveBeenLastCalledWith("plan_1", latest, "2026-11-19T00:00:00.000Z");
    expect([saver.state(), saver.error()]).toEqual(["saved", null]);
  });

  it("tells subscribers it is saving, then saved", async () => {
    const save = vi.fn().mockResolvedValue({ updatedAt: "2026-11-19T00:00:05.000Z" });
    const saver = createSceneSaver({ planId: "plan_1", updatedAt: "2026-11-19T00:00:00.000Z", save });
    const heard: string[] = [];
    saver.subscribe(() => heard.push(saver.state()));

    await saver.save(scene);

    expect(heard).toEqual(["saving", "saved"]);
  });
});
