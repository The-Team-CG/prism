"use client";

import { CalendarDays, CircleUserRound, FileText, LogOut, Settings } from "lucide-react";
import * as React from "react";
import { cn } from "../utils";
import type { PrismAccountMenuItem, PrismUserSummary } from "./types";
function initialsFor(name?: string) {
  if (!name) return "PM";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "PM"
  );
}

function PrismUserAvatar({ user, className }: { user: PrismUserSummary; className?: string }) {
  return (
    <span
      className={cn(
        "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-secondary text-xs font-black text-foreground",
        className,
      )}
      aria-hidden="true"
    >
      {user.initials ?? initialsFor(user.name)}
      <span className="absolute bottom-0.5 right-0.5 size-2.5 rounded-full border-2 border-card bg-(--prism-success)" />
    </span>
  );
}


export function PrismAccountMenu({
  user,
  items = [],
  onSignOut,
}: {
  user: PrismUserSummary;
  items?: PrismAccountMenuItem[];
  onSignOut?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const resolvedItems = React.useMemo<PrismAccountMenuItem[]>(() => {
    const baseItems = items.length
      ? items
      : [
          { id: "profile", label: "My Profile", icon: CircleUserRound },
          { id: "workspace", label: "My Workspace", icon: CalendarDays },
          { id: "documents", label: "My Documents", icon: FileText },
          { id: "settings", label: "Account Settings", icon: Settings, separatorBefore: true },
        ];

    return onSignOut
      ? [
          ...baseItems,
          {
            id: "signout",
            label: "Signout",
            icon: LogOut,
            tone: "danger",
            separatorBefore: true,
            onSelect: onSignOut,
          },
        ]
      : baseItems;
  }, [items, onSignOut]);

  React.useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        className="grid size-9 place-items-center rounded-full outline-none ring-offset-card transition hover:ring-2 hover:ring-primary/18 focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <PrismUserAvatar user={user} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-[0_20px_60px_rgba(23,18,22,0.16)]"
        >
          <div className="flex items-center gap-3 px-4 py-4">
            <PrismUserAvatar user={user} className="size-11" />
            <div className="min-w-0">
              <p className="truncate text-sm font-black leading-5 text-foreground">{user.name}</p>
              {user.detail ? (
                <p className="truncate text-sm leading-5 text-muted-foreground">{user.detail}</p>
              ) : null}
            </div>
          </div>

          <div className="border-t border-border py-1">
            {resolvedItems.map((item) => {
              const Icon = item.icon;
              const content = (
                <>
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </>
              );
              const className = cn(
                "flex h-11 w-full items-center gap-3 px-4 text-left text-sm font-bold transition hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none",
                item.tone === "danger" ? "text-destructive hover:text-destructive" : "text-foreground",
              );

              return (
                <React.Fragment key={item.id}>
                  {item.separatorBefore ? <div className="my-1 border-t border-border" /> : null}
                  {item.href ? (
                    <a href={item.href} role="menuitem" className={className} onClick={() => setOpen(false)}>
                      {content}
                    </a>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      className={className}
                      onClick={() => {
                        setOpen(false);
                        item.onSelect?.();
                      }}
                    >
                      {content}
                    </button>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
