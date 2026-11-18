import type { ComponentProps } from "react";
import type { Editor } from "@pascal-app/editor";
import { LayoutGrid, Layers, Users } from "lucide-react";

export type RailTab = NonNullable<ComponentProps<typeof Editor>["sidebarTabs"]>[number];
export type RailTabId = "library" | "guests" | "layers";

const emptyPanel = () => null;

const TABS: ReadonlyArray<RailTab & { id: RailTabId }> = [
  { id: "library", label: "Library", icon: <LayoutGrid className="size-5" aria-hidden />, component: emptyPanel },
  { id: "guests", label: "Guests", icon: <Users className="size-5" aria-hidden />, component: emptyPanel },
  { id: "layers", label: "Layers", icon: <Layers className="size-5" aria-hidden />, component: emptyPanel },
];

/** The rail's tabs, never Pascal's own. A read-only plan places nothing, so it has no Library. */
export function railTabs(readOnly: boolean): RailTab[] {
  return TABS.filter((tab) => !(readOnly && tab.id === "library"));
}

/** The tab kept open in the column beside the plan. */
export const columnTab = (readOnly: boolean): RailTabId => (readOnly ? "guests" : "library");
