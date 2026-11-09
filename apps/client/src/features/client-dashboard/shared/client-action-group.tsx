"use client";

import { StatusBadge } from "@prism/ui/components/status-badge";
import { Card } from "@prism/ui/components/card";
import type { ClientDashboardAction } from "../workspace/model/client-dashboard-view-rules";

export function ClientActionGroup({
  title,
  description,
  actions,
  onAction,
  showDetailsAndCta = false,
}: {
  title: string;
  description: string;
  actions: ClientDashboardAction[];
  onAction: (action: ClientDashboardAction) => void;
  showDetailsAndCta?: boolean;
}) {
  return (
    <Card className="min-w-0 gap-0 overflow-hidden py-0">
      <header className="border-b border-border px-4 py-4 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </header>
      <div className="divide-y divide-border">
        {actions.length ? (
          actions.map((action) => {
            const Icon = action.icon;
            // Colour marks only the item at risk; everything else stays grey.
            const iconTone = action.tone === "warning" ? "text-attention" : "text-muted-foreground";
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => onAction(action)}
                className="flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:px-5"
              >
                <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${iconTone}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 break-words text-sm font-semibold text-foreground">{action.title}</span>
                    <StatusBadge status={action.status} />
                  </span>
                  <span className="mt-1 block max-w-3xl text-sm leading-6 text-muted-foreground">
                    {action.description}
                  </span>
                  {/* Most descriptions already name the event; only add it when they do not. */}
                  {action.eventName && !action.description?.includes(action.eventName) ? (
                    <span className="mt-1 block break-words text-sm text-muted-foreground">{action.eventName}</span>
                  ) : null}
                  {showDetailsAndCta ? (
                    <span className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{action.detail}</span>
                      <span className="shrink-0 font-semibold text-primary">{action.ctaLabel}</span>
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })
        ) : (
          <p className="px-4 py-5 text-sm text-muted-foreground sm:px-5">Nothing here right now.</p>
        )}
      </div>
    </Card>
  );
}
