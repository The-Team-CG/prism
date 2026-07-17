"use client";

import { eventProgressDots } from "../../workspace/shared";
import { ClientActionGroup } from "../../shared/client-action-group";
import { useClientWorkspace } from "../../workspace/shared";

export function ClientProgressView() {
  const {
    state,
    selectedEvent,
    clientActions,
    runClientAction,
  } = useClientWorkspace();

    const dots = selectedEvent && state ? eventProgressDots(selectedEvent, state) : [];
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dots.map((dot) => (
            <div key={dot.label} className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm">
              <div className={`mb-3 size-2.5 rounded-full ${dot.done ? "bg-(--prism-success)" : "bg-muted-foreground/30"}`} />
              <p className="text-sm font-bold text-foreground">{dot.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{dot.done ? "Complete" : "Pending"}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <ClientActionGroup title="Needs your action" description="Client decisions that can move planning forward." actions={clientActions.filter((a) => a.tone === "primary" || a.tone === "warning")} onAction={runClientAction} />
          <ClientActionGroup title="Waiting on PMCM" description="Being prepared or reviewed by the event team." actions={clientActions.filter((a) => a.tone === "neutral")} onAction={runClientAction} />
          <ClientActionGroup title="Completed" description="Finished client-visible workflow items." actions={clientActions.filter((a) => a.tone === "success")} onAction={runClientAction} />
        </div>
      </div>
    );
}
