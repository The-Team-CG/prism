/** @vitest-environment jsdom */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FloorplanSceneDocument } from "@prism/types";

type CapturedProps = {
  scene: FloorplanSceneDocument;
  readOnly: boolean;
  seating: { allowed: boolean; reason: string | null };
  onSave(document: FloorplanSceneDocument): Promise<unknown>;
};
const editorProps = vi.hoisted(() => ({ current: null as CapturedProps | null }));

vi.mock("@prism/floorplan-canvas/editor", () => ({
  PASCAL_VERSION: "1.1.6",
  PrismFloorplanEditor: (props: CapturedProps) => {
    editorProps.current = props;
    return null;
  },
}));

import { PascalEditorShell } from "./PascalEditorShell";
import type { SceneSaver } from "./use-cases/scene-saver";

const plan = { scene: null, name: "Ballroom", widthM: 20, heightM: 15, objects: [], guests: [] };

function open(role: "pmcm-admin" | "coordinator", screenReadOnly: boolean, eventPrivacy: "private" | "public" = "private") {
  const save = vi.fn(async () => undefined);
  const saver: SceneSaver = { save, retry: async () => undefined, state: () => "saved", subscribe: () => () => undefined, updatedAt: () => "" };
  render(<PascalEditorShell plan={plan} role={role} screenReadOnly={screenReadOnly} guests={[]} suppliers={[]} pax={120} eventPrivacy={eventPrivacy} saver={saver} onSubmit={vi.fn()} onReload={vi.fn()} onBack={vi.fn()} />);
  if (!editorProps.current) throw new Error("The Pascal editor was not mounted");
  return { save, editor: editorProps.current };
}

describe("PascalEditorShell", () => {
  it("opens a coordinator, or anyone on an approved draft, read-only and never saves for them", async () => {
    for (const [role, screenReadOnly] of [["coordinator", false], ["pmcm-admin", true]] as const) {
      const { save, editor } = open(role, screenReadOnly);
      await editor.onSave(editor.scene);
      expect(editor.readOnly).toBe(true);
      expect(save).not.toHaveBeenCalled();
    }
  });

  it("lets PMCM edit an open draft, converting a legacy plan on open and saving through the host", async () => {
    const { save, editor } = open("pmcm-admin", false);
    await editor.onSave(editor.scene);
    expect(editor.readOnly).toBe(false);
    expect(editor.scene).toMatchObject({ format: "pascal-v1", pascalVersion: "1.1.6" });
    expect(save).toHaveBeenCalledWith(editor.scene);
  });

  it("lets a private event under 200 guests seat guests, and tells a public event why it cannot", () => {
    expect(open("pmcm-admin", false).editor.seating).toEqual({ allowed: true, reason: null });
    expect(open("pmcm-admin", false, "public").editor.seating).toEqual({ allowed: false, reason: "Table assignment is only available for private events." });
  });
});
