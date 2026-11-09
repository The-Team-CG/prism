"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cx, useListFilter } from "@/features/pmcm-kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@prism/ui/components/tabs";

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
 * One section of an event tab at a time, chosen from a Tabs strip instead of stacked accordions.
 * The choice lives in the URL (`?part=`) so links, refreshes and Back keep it.
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
    <Tabs value={active.id} onValueChange={setSelected} className="gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList aria-label={label} className="h-auto max-w-full flex-wrap justify-start overflow-x-auto">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="flex-none">
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
            </TabsTrigger>
          ))}
        </TabsList>
        {intro}
      </div>
      <TabsContent value={active.id}>{active.render()}</TabsContent>
    </Tabs>
  );
}

export type WorkspaceRouteTab = { id: string; label: string; href: string };

/** The same Tabs strip for views that each have their own URL. Each trigger is a link; the current view is the active tab. */
export function WorkspaceRouteTabs({ label, tabs, activeId }: { label: string; tabs: WorkspaceRouteTab[]; activeId: string }) {
  return (
    <Tabs value={activeId} className="gap-0">
      <TabsList aria-label={label} className="h-auto max-w-full flex-wrap justify-start overflow-x-auto">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} asChild className="flex-none">
            <Link href={tab.href} aria-current={tab.id === activeId ? "page" : undefined}>
              {tab.label}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
