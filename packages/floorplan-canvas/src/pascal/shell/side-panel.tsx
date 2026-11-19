"use client";

import type { ComponentProps } from "react";
import type { Editor } from "@pascal-app/editor";
import { LayoutGrid } from "lucide-react";
import { usePrismFloorplan } from "../editor-context";
import { GuestsPanel } from "../guests/guests-panel";
import { hostState, usePanelTab, type PanelTab } from "../inspector/host-state";
import { LayersPanel } from "../layers/layers-panel";
import { LibraryPanel } from "../library/library-panel";
import { Segmented } from "./segmented";

type SidebarTab = NonNullable<ComponentProps<typeof Editor>["sidebarTabs"]>[number];

const PANELS: Record<PanelTab, { label: string; component: () => React.ReactNode }> = {
  library: { label: "Library", component: LibraryPanel },
  guests: { label: "Guests", component: GuestsPanel },
  layers: { label: "Layers", component: LayersPanel },
};

/** The tabs a plan offers: a read-only plan places nothing, so it has no Library. */
export const panelTabs = (readOnly: boolean): PanelTab[] => (readOnly ? ["guests", "layers"] : ["library", "guests", "layers"]);

/** The editor's one left panel: Library, Guests and Layers as tabs in its own header. */
export function SidePanel() {
  const { readOnly } = usePrismFloorplan();
  const tabs = panelTabs(readOnly);
  const picked = usePanelTab();
  const open = tabs.includes(picked) ? picked : tabs[0]!;
  const Panel = PANELS[open].component;
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="shrink-0 px-3 pb-2 pt-2.5">
        <Segmented label="Panel" fill value={open} onChange={hostState.setPanelTab} options={tabs.map((tab) => ({ value: tab, label: PANELS[tab].label }))} />
      </div>
      <div className="min-h-0 flex-1">
        <Panel />
      </div>
    </div>
  );
}

/** The one sidebar tab Pascal hosts; it is the whole left column, so Pascal's side menu stays off. */
export const SIDE_PANEL_TAB: SidebarTab & { id: "panel" } = {
  id: "panel",
  label: "Plan",
  icon: <LayoutGrid className="size-5" aria-hidden />,
  component: SidePanel,
};
