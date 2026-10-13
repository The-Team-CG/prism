"use client";

import { portalHref } from "./portal-path";

import type { HTMLAttributes, ReactNode } from "react";
import { ArrowRight, CheckCircle2, ClipboardList, LockKeyhole, ShieldCheck, type LucideIcon } from "lucide-react";
import {
  PrismBadge,
  PrismCard,
  PrismCardContent,
  PrismCardHeader,
  PrismCardTitle,
} from "./primitives";
import { cn } from "./utils";

export interface PrismPublicRoleCard {
  title: string;
  description: string;
  badge: string;
  href?: string;
  actionLabel?: string;
  icon?: ReactNode;
}

export interface PrismLifecycleStep {
  label: string;
  description: string;
  state?: "current" | "done" | "pending";
}

export interface PrismPublicFeature {
  title: string;
  description: string;
  eyebrow?: string;
  icon?: LucideIcon;
}

export function PrismPublicRoleGrid({ roles }: { roles: PrismPublicRoleCard[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {roles.map((role) => (
        <PrismCard key={role.title} className="h-full">
          <PrismCardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {role.icon ?? <ShieldCheck className="size-5" />}
              </div>
              <PrismBadge tone="info">{role.badge}</PrismBadge>
            </div>
            <PrismCardTitle className="mt-3 text-base">{role.title}</PrismCardTitle>
          </PrismCardHeader>
          <PrismCardContent>
            <p className="text-sm leading-6 text-muted-foreground">{role.description}</p>
            {role.href && role.actionLabel ? (
              <a
                href={portalHref(role.href)}
                className="mt-5 inline-flex h-10 w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:bg-secondary"
              >
                {role.actionLabel}
                <ArrowRight className="size-4" />
              </a>
            ) : null}
          </PrismCardContent>
        </PrismCard>
      ))}
    </div>
  );
}

export function PrismLifecycleStrip({ steps }: { steps: PrismLifecycleStep[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {steps.map((step, index) => {
        const Icon = step.state === "done" ? CheckCircle2 : step.state === "current" ? ClipboardList : LockKeyhole;

        return (
          <div
            key={step.label}
            className={cn(
              "rounded-lg border bg-card p-4",
              step.state === "current" ? "border-primary/30" : "border-border",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-muted-foreground">Step {index + 1}</span>
              <Icon className="size-4 text-primary" />
            </div>
            <p className="mt-3 text-sm font-semibold text-foreground">{step.label}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.description}</p>
          </div>
        );
      })}
    </div>
  );
}

export function PrismPublicFeatureBand({
  eyebrow: _eyebrow,
  title,
  description,
  features,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  features: PrismPublicFeature[];
  dark?: boolean;
}) {
  return (
    <section className={cn("rounded-lg border p-5 sm:p-6", dark ? "border-white/10 bg-white/8" : "border-primary/12 bg-card/78")}>
      <div className="grid gap-6 lg:grid-cols-[0.72fr_1fr] lg:items-start">
        <div>
          <h2 className={cn("text-3xl font-black leading-tight sm:text-4xl", dark ? "text-sidebar-foreground" : "text-foreground")}>{title}</h2>
          <p className={cn("mt-3 text-sm leading-6", dark ? "text-sidebar-foreground/70" : "text-muted-foreground")}>{description}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {features.map((feature) => {
            const Icon = feature.icon ?? ShieldCheck;
            return (
              <div key={feature.title} className={cn("rounded-lg border p-4", dark ? "border-white/10 bg-black/12" : "border-border bg-background/70")}>
                <div className={cn("mb-3 flex size-10 items-center justify-center rounded-md", dark ? "bg-white/10 text-(--prism-amber)" : "bg-primary/10 text-primary")}>
                  <Icon className="size-5" />
                </div>
                {feature.eyebrow ? (
                  <p className={cn("text-[10px] font-black uppercase tracking-[0.14em]", dark ? "text-sidebar-foreground/48" : "text-muted-foreground")}>{feature.eyebrow}</p>
                ) : null}
                <h3 className={cn("mt-1 text-base font-black", dark ? "text-sidebar-foreground" : "text-foreground")}>{feature.title}</h3>
                <p className={cn("mt-2 text-sm leading-6", dark ? "text-sidebar-foreground/66" : "text-muted-foreground")}>{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function PrismVisualFrame({
  children,
  dark = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-lg border p-4 shadow-[0_34px_120px_rgba(23,18,22,0.18)]",
      dark ? "border-white/10 bg-white/8" : "border-primary/14 bg-card/82",
      className,
    )} {...props}>
      <div className={cn(
        "absolute inset-0 opacity-35",
        dark
          ? "[background-image:linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:32px_32px]"
          : "[background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:32px_32px]",
      )} />
      <div className="relative">{children}</div>
    </div>
  );
}
