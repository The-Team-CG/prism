"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "../components/ui/dropdown-menu";
import { portalHref } from "../portal-path";
import type { PrismAppShellProps, PrismUserSummary } from "./types";

export function initialsFor(name: string, initials?: string) {
  if (initials) return initials.slice(0, 2).toUpperCase();
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** What the account menu holds, in the sidebar footer on desktop and behind the avatar in the phone top bar. */
export function AccountMenuEntries({ user, items, onSignOut, rowClassName }: {
  user: PrismUserSummary;
  items?: PrismAppShellProps["accountMenuItems"];
  onSignOut?: () => void;
  /** Phones pass a taller row so each entry is a comfortable tap. */
  rowClassName?: string;
}) {
  return (
    <>
      <DropdownMenuLabel className="grid font-normal">
        <span className="truncate font-semibold text-foreground">{user.name}</span>
        {user.detail ? <span className="truncate text-xs text-muted-foreground">{user.detail}</span> : null}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      {items?.map((entry) => (
        <DropdownMenuItem key={entry.id} className={rowClassName} asChild={Boolean(entry.href)} onSelect={entry.onSelect} variant={entry.tone === "danger" ? "destructive" : "default"}>
          {entry.href ? (
            <a href={portalHref(entry.href)}>
              <entry.icon aria-hidden="true" />
              {entry.label}
            </a>
          ) : (
            <>
              <entry.icon aria-hidden="true" />
              {entry.label}
            </>
          )}
        </DropdownMenuItem>
      ))}
      <DropdownMenuItem className={rowClassName} asChild>
        <a href={portalHref("/privacy")}>
          <ShieldCheck aria-hidden="true" />
          Privacy notice
        </a>
      </DropdownMenuItem>
      {onSignOut ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem className={rowClassName} onSelect={onSignOut}>
            <LogOut aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </>
      ) : null}
    </>
  );
}
