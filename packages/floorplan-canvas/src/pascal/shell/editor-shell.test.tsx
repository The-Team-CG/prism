/** @vitest-environment jsdom */
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { FLOORPLAN_SCENE_FORMAT, type SceneSaveState } from "@prism/types";

type EditorProps = { navbarSlot: ReactNode; sidebarTabs: Array<{ id: string; component: () => ReactNode }>; columnTabId: string };

vi.mock("@pascal-app/editor", () => {
  const editorState = { gridSnapStep: 0.5, mode: "select", tool: null, setViewLayout: vi.fn() };
  const useEditor = Object.assign((select: (state: unknown) => unknown) => select(editorState), { getState: () => editorState });
  return {
    Editor: ({ navbarSlot, sidebarTabs, columnTabId }: EditorProps) => {
      const Column = sidebarTabs.find((tab) => tab.id === columnTabId)!.component;
      return (
        <div>
          <header>{navbarSlot}</header>
          <aside aria-label="Left panel">
            <Column />
          </aside>
        </div>
      );
    },
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
vi.mock("../library/library-panel", () => ({ LibraryPanel: () => <p>Library pieces</p> }));
vi.mock("../guests/guests-panel", () => ({ GuestsPanel: () => <p>Guest list</p> }));
vi.mock("../layers/layers-panel", () => ({ LayersPanel: () => <p>Layer list</p> }));

const { PrismFloorplanEditor } = await import("../prism-floorplan-editor");
const { saveDisplay } = await import("./editor-header");

function screenWidth(small: boolean) {
  window.matchMedia = (query: string) =>
    ({ matches: small && query === "(max-width: 767px)", addEventListener: () => undefined, removeEventListener: () => undefined }) as unknown as MediaQueryList;
}

type Overrides = {
  readOnly?: boolean;
  seatingAllowed?: boolean;
  saveState?: SceneSaveState;
  onRetrySave?: () => void;
  onReload?: () => void;
  onSaveTemplate?: (document: unknown, name: string) => Promise<unknown>;
};

async function openEditor(overrides: Overrides = {}) {
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
      onSaveTemplate={overrides.onSaveTemplate}
      eventName="Santos wedding"
      draftName="Reception"
    />,
  );
  await screen.findByRole("complementary", { name: "Left panel" });
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

  it("opens on the Library tab of one left panel, with Guests and Layers as its other tabs", async () => {
    screenWidth(false);
    await openEditor();
    expect(await screen.findByRole("button", { name: /Submit for review/ })).toBeTruthy();
    const tabs = within(screen.getByRole("group", { name: "Panel" })).getAllByRole("button");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Library", "Guests", "Layers"]);
    expect(screen.getByText("Library pieces")).toBeTruthy();
    fireEvent.click(tabs[1]!);
    expect(screen.getByText("Guest list")).toBeTruthy();
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

  it("names the plan in the middle of the bar, and its menu saves the plan as a venue template", async () => {
    screenWidth(false);
    const onSaveTemplate = vi.fn(async () => undefined);
    await openEditor({ onSaveTemplate });
    fireEvent.click(screen.getByRole("button", { name: /Santos wedding.*Reception/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Save as venue template/ }));
    fireEvent.change(screen.getByLabelText("Save as venue template"), { target: { value: "Grand Ballroom" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(onSaveTemplate).toHaveBeenCalledWith(expect.anything(), "Grand Ballroom"));
    await vi.waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("says View only, with no Submit, tools or Library, when the plan is read-only", async () => {
    screenWidth(false);
    await openEditor({ readOnly: true });
    expect(await screen.findByText("View only")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Submit for review/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Library" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Tools" })).toBeNull();
    expect(screen.getByText("Guest list")).toBeTruthy();
    expect(screen.queryByText("Edit on a laptop")).toBeNull();
  });

  it("opens view-only on a small screen and says to edit on a laptop", async () => {
    screenWidth(true);
    await openEditor();
    expect(await screen.findByText("View only")).toBeTruthy();
    expect(screen.getByText("Edit on a laptop")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Library" })).toBeNull();
  });
});
