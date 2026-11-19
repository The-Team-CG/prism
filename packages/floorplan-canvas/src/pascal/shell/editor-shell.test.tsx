/** @vitest-environment jsdom */
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FLOORPLAN_SCENE_FORMAT, type SceneSaveState } from "@prism/types";

type EditorProps = { navbarSlot: ReactNode; sidebarTabs: Array<{ id: string; label: string }>; columnTabId: string };

vi.mock("@pascal-app/editor", () => {
  const editorState = { gridSnapStep: 0.5, mode: "select", tool: null, setViewLayout: vi.fn() };
  const useEditor = Object.assign((select: (state: unknown) => unknown) => select(editorState), { getState: () => editorState });
  return {
    Editor: ({ navbarSlot, sidebarTabs, columnTabId }: EditorProps) => (
      <div>
        <header>{navbarSlot}</header>
        <nav aria-label="Rail">
          {sidebarTabs.map((tab) => (
            <span key={tab.id} data-column={tab.id === columnTabId}>
              {tab.label}
            </span>
          ))}
        </nav>
      </div>
    ),
    useEditor,
    visibleScene: () => "2d",
    sceneLayout: (scene: string) => scene,
    getSavedSceneDocument: () => ({ nodes: {}, rootNodeIds: [] }),
    useCameraHintFocus: { getState: () => ({ focus: () => undefined }) },
    getHistoryCommandState: () => ({ canUndo: false, canRedo: false }),
    subscribeHistoryCommandState: () => () => undefined,
    runUndo: vi.fn(),
    runRedo: vi.fn(),
  };
});

vi.mock("@pascal-app/core", () => {
  const sceneState = { nodes: {}, rootNodeIds: [] };
  return {
    loadPlugin: async () => undefined,
    acquireSceneReadOnlyLease: () => () => undefined,
    useScene: (select: (state: unknown) => unknown) => select(sceneState),
  };
});
vi.mock("@pascal-app/nodes", () => ({ builtinPlugin: {} }));
vi.mock("@pascal-app/viewer", () => ({ useViewer: (select: (state: unknown) => unknown) => select({ selection: { levelId: null } }) }));
vi.mock("../event-layout-plugin", () => ({ prismEventLayoutPlugin: {} }));
vi.mock("../pascal-runtime", () => ({}));

const { PrismFloorplanEditor } = await import("../prism-floorplan-editor");
const { saveDisplay } = await import("./editor-header");

function screenWidth(small: boolean) {
  window.matchMedia = (query: string) =>
    ({ matches: small && query === "(max-width: 767px)", addEventListener: () => undefined, removeEventListener: () => undefined }) as unknown as MediaQueryList;
}

async function openEditor(overrides: { readOnly?: boolean; seatingAllowed?: boolean; saveState?: SceneSaveState; onRetrySave?: () => void; onReload?: () => void } = {}) {
  render(
    <PrismFloorplanEditor
      scene={{ format: FLOORPLAN_SCENE_FORMAT, pascalVersion: "1.1.6", nodes: {}, rootNodeIds: [] }}
      readOnly={overrides.readOnly ?? false}
      onSave={async () => undefined}
      onSubmit={async () => undefined}
      onBack={() => undefined}
      guests={[]}
      suppliers={[]}
      seating={{ allowed: overrides.seatingAllowed ?? true, reason: null }}
      guestCount={120}
      saveState={overrides.saveState ?? "saved"}
      onRetrySave={overrides.onRetrySave ?? (() => undefined)}
      onReload={overrides.onReload ?? (() => undefined)}
      
      draftName="Reception"
    />,
  );
  await screen.findByRole("navigation", { name: "Rail" });
}

afterEach(cleanup);

describe("the floor plan editor shell", () => {
  it("shows Saved once a retry succeeds, though Pascal still remembers the failed autosave", () => {
    expect(saveDisplay("saved", "error")).toBe("saved");
    expect(saveDisplay("failed", "saved")).toBe("failed");
    expect(saveDisplay("saved", "pending")).toBe("saving");
  });

  it("offers Retry after a failed save and Reload after a conflict", async () => {
    screenWidth(false);
    const onRetrySave = vi.fn();
    await openEditor({ saveState: "failed", onRetrySave });
    fireEvent.click(screen.getByRole("button", { name: "Not saved · Retry" }));
    expect(onRetrySave).toHaveBeenCalledTimes(1);
    cleanup();

    const onReload = vi.fn();
    await openEditor({ saveState: "conflict", onReload });
    fireEvent.click(screen.getByRole("button", { name: "Changed elsewhere · Reload" }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("opens with the Library beside the plan and every rail tab while editing", async () => {
    screenWidth(false);
    await openEditor();
    expect(await screen.findByRole("button", { name: /Submit for review/ })).toBeTruthy();
    const rail = screen.getByRole("navigation", { name: "Rail" });
    expect([...rail.children].map((tab) => tab.textContent)).toEqual(["Library", "Guests", "Layers"]);
    expect(screen.getByText("Library").dataset.column).toBe("true");
    expect(screen.getByText("0 seats for 120 guests")).toBeTruthy();
  });

  it("prints the floor plan and pull sheet, and the seating list only where guests can be seated", async () => {
    screenWidth(false);
    const printable = () => {
      fireEvent.click(screen.getByRole("button", { name: /Print/ }));
      return screen.getAllByRole("menuitem").map((item) => item.textContent);
    };
    await openEditor();
    expect(printable()).toEqual(["Floor plan", "Pull sheet", "Seating list"]);
    cleanup();
    await openEditor({ seatingAllowed: false });
    expect(printable()).toEqual(["Floor plan", "Pull sheet"]);
    cleanup();
    await openEditor({ readOnly: true });
    expect(printable()).toEqual(["Floor plan", "Pull sheet", "Seating list"]);
  });

  it("says View only, with no Submit or Library, when the plan is read-only", async () => {
    screenWidth(false);
    await openEditor({ readOnly: true });
    expect(await screen.findByText("View only")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Submit for review/ })).toBeNull();
    expect(screen.queryByText("Library")).toBeNull();
    expect(screen.queryByText("Edit on a laptop")).toBeNull();
  });

  it("opens view-only on a small screen and says to edit on a laptop", async () => {
    screenWidth(true);
    await openEditor();
    expect(await screen.findByText("View only")).toBeTruthy();
    expect(screen.getByText("Edit on a laptop")).toBeTruthy();
    expect(screen.queryByText("Library")).toBeNull();
  });
});
