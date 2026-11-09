"use client";

import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@prism/ui/components/tabs";

export type ClientRouteTab = { id: string; label: string; href: string; count?: number };

/**
 * Sub-views that live on their own routes. Each tab is a link, so the active tab is the route the
 * page is on (`activeId`) and the browser back button walks the views.
 */
export function ClientRouteTabs({ label, tabs, activeId }: { label: string; tabs: ClientRouteTab[]; activeId: string }) {
  return (
    <Tabs value={activeId} className="min-w-0">
      <TabsList aria-label={label} className="h-auto max-w-full justify-start overflow-x-auto">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} asChild>
            <Link href={tab.href} aria-current={tab.id === activeId ? "page" : undefined}>
              {tab.label}
              {tab.count !== undefined ? <span className="tabular-nums text-muted-foreground">{tab.count}</span> : null}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
