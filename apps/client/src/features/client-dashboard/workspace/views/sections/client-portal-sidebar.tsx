"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { PrismBrandLogo } from "@prism/ui";
import { cn } from "@/app/components/ui/utils";
import type { ClientSidebarRenderItem } from "../../model/client-dashboard-types";

export function ClientPortalSidebar({
  navItems,
  activeItemId,
  onSelect,
  collapsed,
}: {
  navItems: ClientSidebarRenderItem[];
  activeItemId: string;
  onSelect: (id: string) => void;
  collapsed: boolean;
}) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const open = new Set<string>();
    for (const item of navItems) {
      const subItemActive = item.subItems?.some((sub) => sub.id === activeItemId) ?? false;
      if (subItemActive || item.id === activeItemId) open.add(item.id);
    }
    return open;
  });

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full w-full min-w-0 flex-col bg-card text-foreground">
      <PrismBrandLogo
        href="/"
        title="P.R.I.S.M."
        detail="Client Portal"
        compact={collapsed}
        className={cn("min-h-16 shrink-0 px-3", collapsed && "justify-center px-2")}
        markClassName="size-8 bg-transparent ring-0"
      />

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4 pt-1">
        <div className="flex flex-col gap-1">
          {navItems.map((item) => {
            const hasSubItems = Boolean(item.subItems?.length);
            const subItemActive = item.subItems?.some((sub) => sub.id === activeItemId) ?? false;
            const itemActive = item.id === activeItemId || subItemActive;
            const isOpen = openGroups.has(item.id);
            const Icon = item.icon;

            return (
              <div key={item.id} className="min-w-0">
                <button
                  type="button"
                  disabled={item.disabled}
                  data-active={itemActive}
                  onClick={() => {
                    onSelect(item.id);
                    if (hasSubItems) toggleGroup(item.id);
                  }}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex h-9 w-full items-center gap-2.5 overflow-hidden rounded-md px-2.5 text-left text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:bg-secondary focus-visible:text-foreground disabled:cursor-not-allowed disabled:opacity-45 data-[active=true]:bg-primary/10 data-[active=true]:font-semibold data-[active=true]:text-primary",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {hasSubItems && (
                        <ChevronRight
                          className={cn("size-3.5 shrink-0 text-muted-foreground/60 transition-transform", isOpen && "rotate-90")}
                          aria-hidden="true"
                        />
                      )}
                    </>
                  )}
                </button>

                {hasSubItems && isOpen && !collapsed && (
                  <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-border/60 pl-2">
                    {item.subItems?.map((subItem) => (
                      <button
                        key={subItem.id}
                        type="button"
                        disabled={item.disabled || subItem.disabled}
                        data-active={subItem.id === activeItemId}
                        onClick={() => onSelect(subItem.id)}
                        className="flex min-h-7 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 data-[active=true]:bg-primary/10 data-[active=true]:font-bold data-[active=true]:text-primary"
                      >
                        <span className="size-1.5 shrink-0 rounded-full bg-current opacity-40" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{subItem.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
