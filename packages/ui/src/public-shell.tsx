"use client";

import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { PrismBadge } from "./primitives";
import { cn } from "./utils";

export interface PrismPublicShellProps {
  eyebrow: string;
  title: string;
  description: string;
  badgeIcon?: LucideIcon;
  badgeText?: string;
  productDetail?: string;
  aside: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function PrismPublicShell({
  eyebrow,
  title,
  description,
  badgeIcon: BadgeIcon,
  badgeText,
  productDetail = "Event operating system",
  aside,
  children,
  className,
}: PrismPublicShellProps) {
  return (
    <main className={cn("min-h-screen overflow-auto bg-background text-foreground", className)}>
      <section className="relative min-h-screen px-5 py-6 sm:px-8 lg:px-10">
        <div className="absolute inset-0 bg-[linear-gradient(125deg,rgba(255,248,242,0.96),rgba(233,247,251,0.76)_58%,rgba(255,248,242,0.96))]" />
        <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:38px_38px]" />
        <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1180px] grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,0.95fr)_420px]">
          <div className="max-w-3xl">
            <a href="/" className="mb-10 inline-flex items-center gap-3 no-underline">
              <span className="flex h-12 w-36 items-center justify-center rounded-md border border-primary/12 bg-white px-3 shadow-sm">
                <img src="/pmcm-logo.png" alt="PMCM logo" className="h-9 w-full object-contain" />
              </span>
              <span>
                <span className="block text-xs font-black uppercase tracking-[0.24em] text-foreground">P.R.I.S.M</span>
                <span className="block text-sm text-muted-foreground">{productDetail}</span>
              </span>
            </a>

            {badgeText ? (
              <PrismBadge variant="warning" className="mb-6 px-4 py-2 uppercase tracking-[0.16em]">
                {BadgeIcon ? <BadgeIcon aria-hidden="true" /> : null}
                {badgeText}
              </PrismBadge>
            ) : null}
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
            <h1 className="mt-4 text-5xl font-black leading-[0.96] text-foreground sm:text-6xl lg:text-7xl">{title}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">{description}</p>
            {children ? <div className="mt-8">{children}</div> : null}
          </div>

          <div>{aside}</div>
        </div>
      </section>
    </main>
  );
}
