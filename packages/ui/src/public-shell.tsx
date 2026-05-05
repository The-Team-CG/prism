"use client";

import type * as React from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { PrismBrandLogo } from "./brand";
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
            <PrismBrandLogo href="/" detail={productDetail} className="mb-10" markClassName="size-12 bg-transparent ring-0" />

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

export interface PrismMarketingNavItem {
  label: string;
  href: string;
}

export interface PrismMarketingAction {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
  icon?: React.ReactNode;
}

export interface PrismMarketingStat {
  label: string;
  value: string;
  detail: string;
}

export interface PrismMarketingShellProps {
  eyebrow: string;
  title: string;
  description: string;
  productDetail: string;
  badgeIcon?: LucideIcon;
  badgeText?: string;
  navItems?: PrismMarketingNavItem[];
  actions: PrismMarketingAction[];
  stats?: PrismMarketingStat[];
  aside: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  surface?: "light" | "dark";
  heroAlign?: "center" | "start";
}

export function PrismMarketingShell({
  eyebrow,
  title,
  description,
  productDetail,
  badgeIcon: BadgeIcon,
  badgeText,
  navItems = [],
  actions,
  stats = [],
  aside,
  children,
  className,
  surface = "light",
  heroAlign = "center",
}: PrismMarketingShellProps) {
  const dark = surface === "dark";

  return (
    <main className={cn("min-h-screen overflow-auto bg-background text-foreground", dark && "bg-(--prism-ink)", className)}>
      <section className={cn("relative min-h-screen overflow-hidden px-5 py-5 sm:px-8 lg:px-10", dark && "text-sidebar-foreground")}>
        <div className={cn(
          "absolute inset-0",
          dark
            ? "bg-[linear-gradient(135deg,#171216,#251722_48%,#10242b)]"
            : "bg-[linear-gradient(125deg,rgba(255,248,242,0.98),rgba(233,247,251,0.86)_54%,rgba(255,240,230,0.96))]",
        )} />
        <div className={cn(
          "absolute inset-0 opacity-40",
          dark
            ? "[background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:44px_44px]"
            : "[background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:38px_38px]",
        )} />
        <div className={cn(
          "absolute inset-x-0 top-0 h-32",
          dark ? "bg-[linear-gradient(180deg,rgba(240,96,48,0.16),transparent)]" : "bg-[linear-gradient(180deg,rgba(192,24,103,0.08),transparent)]",
        )} />

        <div className="relative mx-auto max-w-[1480px]">
          <header className={cn(
            "sticky top-4 z-30 flex items-center justify-between gap-4 rounded-lg border px-4 py-3 backdrop-blur-xl",
            dark
              ? "border-white/10 bg-white/8 shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
              : "border-primary/12 bg-card/84 shadow-[0_18px_60px_rgba(23,18,22,0.08)]",
          )}>
            <PrismBrandLogo
              href="/"
              detail={productDetail}
              dark={dark}
              markClassName="size-12 bg-transparent ring-0"
            />

            {navItems.length > 0 ? (
              <nav className="hidden items-center gap-1 lg:flex" aria-label="Landing page sections">
                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm font-bold transition",
                      dark ? "text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            ) : null}

            <div className="hidden items-center gap-2 md:flex">
              {actions.slice(0, 2).map((action) => (
                <a
                  key={action.href}
                  href={action.href}
                  className={cn(
                    "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-black transition",
                    action.variant === "secondary"
                      ? dark
                        ? "border border-white/15 bg-white/8 text-sidebar-foreground hover:bg-white/14"
                        : "border border-border bg-card text-foreground hover:bg-secondary"
                      : "bg-primary text-primary-foreground shadow-[0_16px_36px_rgba(23,18,22,0.18)] hover:bg-primary/90",
                  )}
                >
                  {action.icon}
                  {action.label}
                </a>
              ))}
            </div>
          </header>

          <div className={cn(
            "grid min-h-[calc(100vh-5.5rem)] gap-10 py-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(460px,0.78fr)] xl:gap-14",
            heroAlign === "start" ? "items-start" : "items-center",
          )}>
            <div className="max-w-4xl">
              {badgeText ? (
                <PrismBadge tone={dark ? "warning" : "info"} className="mb-6 px-4 py-2 uppercase tracking-[0.16em]">
                  {BadgeIcon ? <BadgeIcon aria-hidden="true" /> : null}
                  {badgeText}
                </PrismBadge>
              ) : null}
              <p className={cn("text-[11px] font-black uppercase tracking-[0.2em]", dark ? "text-(--prism-amber)" : "text-primary")}>{eyebrow}</p>
              <h1 className={cn("mt-4 text-5xl font-black leading-[0.92] sm:text-6xl xl:text-[5.8rem]", dark ? "text-sidebar-foreground" : "text-foreground")}>{title}</h1>
              <p className={cn("mt-6 max-w-2xl text-lg leading-8", dark ? "text-sidebar-foreground/76" : "text-muted-foreground")}>{description}</p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {actions.map((action) => (
                  <a
                    key={`${action.href}-${action.label}`}
                    href={action.href}
                    className={cn(
                      "inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-5 text-sm font-black uppercase tracking-[0.12em] transition",
                      action.variant === "secondary"
                        ? dark
                          ? "border border-white/15 bg-white/8 text-sidebar-foreground hover:bg-white/14"
                          : "border border-border bg-card text-foreground hover:bg-secondary"
                        : "bg-primary text-primary-foreground shadow-[0_18px_42px_rgba(23,18,22,0.22)] hover:bg-primary/90",
                    )}
                  >
                    {action.icon}
                    {action.label}
                    {action.variant === "secondary" ? null : <ArrowRight aria-hidden="true" className="size-4" />}
                  </a>
                ))}
              </div>

              {stats.length > 0 ? (
                <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
                  {stats.map((stat) => (
                    <div
                      key={stat.label}
                      className={cn(
                        "rounded-lg border p-4",
                        dark ? "border-white/10 bg-white/8" : "border-primary/12 bg-card/74",
                      )}
                    >
                      <p className={cn("text-[10px] font-black uppercase tracking-[0.16em]", dark ? "text-(--prism-amber)" : "text-(--prism-amber)")}>{stat.label}</p>
                      <p className={cn("mt-2 text-3xl font-black", dark ? "text-sidebar-foreground" : "text-foreground")}>{stat.value}</p>
                      <p className={cn("mt-1 text-sm leading-5", dark ? "text-sidebar-foreground/66" : "text-muted-foreground")}>{stat.detail}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div>{aside}</div>
          </div>

          {children ? <div className="pb-20">{children}</div> : null}
        </div>
      </section>
    </main>
  );
}
