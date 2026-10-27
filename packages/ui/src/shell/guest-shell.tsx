"use client";

import type * as React from "react";
import { PrismBrandLogo } from "../brand";
import { cn } from "../utils";

export interface PrismGuestShellProps {
  /** The event this pass opens, shown as the page title. */
  eventName: string;
  /** One line under the title: the date and anything the guest shows at the door. */
  detail?: React.ReactNode;
  /** Right side of the top bar, such as leaving the pass. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** The guest portal frame: one event, one column, no navigation to learn. */
export function PrismGuestShell({ eventName, detail, actions, children, className }: PrismGuestShellProps) {
  return (
    <div className={cn("prism-shell min-h-screen bg-background text-foreground", className)} data-portal="guest">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <PrismBrandLogo href="/" title="P.R.I.S.M." detail="Guest pass" markClassName="size-8 rounded-md bg-card ring-1 ring-border" />
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 grid gap-1">
          <h1 className="font-heading text-2xl font-bold leading-tight text-foreground">{eventName}</h1>
          {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
