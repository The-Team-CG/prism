"use client";

import type { ReactNode } from "react";
import { cx, useListFilter } from "@/features/pmcm-kit";

export type WorkspaceSubTab = {
  id: string;
  label: string;
  /** Small count shown beside the label, e.g. open items. Hidden when zero or absent. */
  count?: number;
  /** Highlights the count when the section needs attention. */
  attention?: boolean;
  render: () => ReactNode;
};

/**
 * One section of an event tab at a time, chosen from a segmented switcher instead of stacked
 * accordions. The choice lives in the URL (`?part=`) so links, refreshes and Back keep it.
 */
export function WorkspaceSubTabs({ label, tabs, intro, defaultId }: { label: string; tabs: WorkspaceSubTab[]; intro?: ReactNode; defaultId?: string }) {
  const [selected, setSelected] = useListFilter("part", defaultId ?? tabs[0]?.id ?? "");
  const active = tabs.find((tab) => tab.id === selected) ?? tabs[0];
  if (!active) return null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label={label} className="-mx-1 flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1">
          {tabs.map((tab) => {
            const isActive = tab.id === active.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`subtab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`subtab-panel-${tab.id}`}
                onClick={() => setSelected(tab.id)}
                className={cx(
                  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {tab.count ? (
                  <span
                    className={cx(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      tab.attention ? "bg-attention-soft text-attention" : "bg-background text-muted-foreground",
                    )}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {intro}
      </div>
      <div role="tabpanel" id={`subtab-panel-${active.id}`} aria-labelledby={`subtab-${active.id}`}>
        {active.render()}
      </div>
    </div>
  );
}
