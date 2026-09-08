"use client";

import { StatusBadge } from "@/app/components/ui/status-badge";
import type { ClientDashboardAction } from "../workspace/model/client-dashboard-view-rules";

export function ClientActionGroup({
  title,
  description,
  actions,
  onAction,
}: {
  title: string;
  description: string;
  actions: ClientDashboardAction[];
  onAction: (action: ClientDashboardAction) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <header className="border-b border-border px-5 py-4">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </header>
      <div className="divide-y divide-border">
        {actions.length ? (
          actions.map((action) => {
            const Icon = action.icon;
            const toneStyle =
              action.tone === "primary"
                ? "bg-(--prism-signal-soft) text-(--prism-signal)"
                : action.tone === "success"
                  ? "bg-(--prism-success)/10 text-(--prism-success)"
                  : action.tone === "warning"
                    ? "bg-(--prism-amber-soft) text-(--prism-amber)"
                    : "bg-muted text-muted-foreground";
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => onAction(action)}
                className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--prism-signal) focus-visible:ring-inset"
              >
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${toneStyle}`}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-foreground">{action.title}</span>
                    <StatusBadge status={action.status} />
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground line-clamp-2">
                    {action.description}
                  </span>
                </span>
              </button>
            );
          })
        ) : (
          <p className="px-5 py-6 text-sm text-muted-foreground">No items yet.</p>
        )}
      </div>
    </div>
  );
}
