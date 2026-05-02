"use client";

import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, ClipboardList, LockKeyhole, ShieldCheck } from "lucide-react";
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
                href={role.href}
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
