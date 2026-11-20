"use client";

import { useEffect, useState } from "react";
import { cx } from "./helpers";

export type SegmentedAnchorItem = {
  id: string;
  label: string;
  href: string;
};

/** A segmented visual treatment for real links that navigate to sections or routes. */
export function SegmentedAnchorNav({
  label,
  items,
}: {
  label: string;
  items: readonly SegmentedAnchorItem[];
}) {
  const defaultActiveId = items[0]?.id ?? "";
  const [activeId, setActiveId] = useState(defaultActiveId);

  useEffect(() => {
    const syncActiveAnchor = () => {
      const hash = window.location.hash.slice(1);
      const activeAnchor = items.find((item) => item.href === `#${hash}`);
      setActiveId(activeAnchor?.id ?? defaultActiveId);
    };

    syncActiveAnchor();
    window.addEventListener("hashchange", syncActiveAnchor);
    return () => window.removeEventListener("hashchange", syncActiveAnchor);
  }, [defaultActiveId, items]);

  return (
    <nav aria-label={label} className="max-w-full overflow-x-auto">
      <div className="inline-flex min-w-max items-center rounded-lg bg-muted p-1">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <a
              key={item.id}
              href={item.href}
              aria-current={isActive ? "location" : undefined}
              onClick={() => {
                if (item.href.startsWith("#")) setActiveId(item.id);
              }}
              className={cx(
                "inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                isActive
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
