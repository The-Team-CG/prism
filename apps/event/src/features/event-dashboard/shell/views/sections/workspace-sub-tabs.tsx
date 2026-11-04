"use client";

import type { ReactNode } from "react";
import Link from "next/link";
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

function subTabClassName(isActive: boolean) {
  return cx(
    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
    isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
  );
}

/** The segmented strip shared by the state-backed and route-backed tab components below. */
const TAB_LIST_CLASS = "-mx-1 flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1 sm:flex-nowrap sm:overflow-x-auto";

/**
 * One section of an event tab at a time, chosen from a segmented switcher instead of stacked
 * accordions. The choice lives in the URL (`?part=`) so links, refreshes and Back keep it.
 */
export function WorkspaceSubTabs({
  label,
  tabs,
  intro,
  defaultId,
  selectedId,
  onSelect,
}: {
  label: string;
  tabs: WorkspaceSubTab[];
  intro?: ReactNode;
  defaultId?: string;
  /** Lets the owner drive the selection, e.g. a close gate that links to another step. Uncontrolled when absent. */
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  const [uncontrolled, setUncontrolled] = useListFilter("part", defaultId ?? tabs[0]?.id ?? "");
  const selected = selectedId ?? uncontrolled;
  const setSelected = onSelect ?? setUncontrolled;
  const active = tabs.find((tab) => tab.id === selected) ?? tabs[0];
  if (!active) return null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label={label} className={TAB_LIST_CLASS}>
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
                className={subTabClassName(isActive)}
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

export type WorkspaceRouteTab = { id: string; label: string; href: string };

/** The same tab strip for views that each have their own URL. The current view is `aria-current`. */
export function WorkspaceRouteTabs({ label, tabs, activeId }: { label: string; tabs: WorkspaceRouteTab[]; activeId: string }) {
  return (
    <nav aria-label={label}>
      <ul className={TAB_LIST_CLASS}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <li key={tab.id}>
              <Link href={tab.href} aria-current={isActive ? "page" : undefined} className={subTabClassName(isActive)}>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
