"use client";

import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "./utils";

export interface PrismEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function PrismEmptyState({ icon: Icon, title, description, action, className }: PrismEmptyStateProps) {
  return (
    <div className={cn("grid min-h-48 place-items-center rounded-lg border border-dashed border-border bg-card p-6 text-center", className)}>
      <div className="mx-auto max-w-sm">
        {Icon ? (
          <span className="mx-auto mb-3 grid size-10 place-items-center rounded-md bg-secondary text-primary">
            <Icon aria-hidden="true" />
          </span>
        ) : null}
        <h3 className="text-sm font-black text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}
