"use client";

import { WalletCards, FileText } from "lucide-react";
import { PrismStatusTimeline } from "@prism/ui/blocks";
import { PrismBillingMilestoneList } from "@prism/ui/blocks";
import { PrismStatusBadge } from "@prism/ui/status-badge";
import { PRISM_LIFECYCLE_STAGES, PRISM_LIFECYCLE_STAGE_LABELS } from "@prism/types";
import { Card, CardHeader, CardBody } from "@/features/client-dashboard/shared/tab-ui";
import { ClientActionGroup } from "@/features/client-dashboard/shared/client-action-group";
import { useEventProgressView } from "../view-models/use-event-progress-view";

export function EventProgressView() {
  const progress = useEventProgressView();
  const { clientActions, runClientAction } = progress;

  if (!progress.hasEvent) {
    return null;
  }

  const needsAction = clientActions.filter((a) => a.tone === "primary" || a.tone === "warning");
  const waiting = clientActions.filter((a) => a.tone === "neutral");
  const completedActions = clientActions.filter((a) => a.tone === "success");
  const doneCheckpoints = progress.checkpoints.filter((c) => c.done).length;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <h2 className="text-base font-bold text-foreground">Current stage: {progress.lifecycleStage}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Stage {progress.lifecycleIndex + 1} of {PRISM_LIFECYCLE_STAGES.length}
          </p>
        </CardHeader>
        <CardBody>
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="Event lifecycle">
            {PRISM_LIFECYCLE_STAGES.map((stage, i) => {
              const done = i < progress.lifecycleIndex;
              const current = i === progress.lifecycleIndex;
              return (
                <div
                  key={stage}
                  aria-current={current ? "step" : undefined}
                  className={`rounded-xl border px-3 py-3 text-center text-sm font-semibold ${
                    done
                      ? "border-success/30 bg-success/5 text-success"
                      : current
                        ? "border-primary/30 bg-primary/5 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground"
                  }`}
                >
                  {PRISM_LIFECYCLE_STAGE_LABELS[stage]}
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-success/10 text-success">
            <FileText size={18} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {doneCheckpoints} of {progress.checkpoints.length}
            </p>
            <p className="text-xs text-muted-foreground">Checkpoints done</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <WalletCards size={18} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{progress.paymentMilestones.length}</p>
            <p className="text-xs text-muted-foreground">Payment milestones</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-base font-bold text-foreground">Planning checkpoints</h2>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                {progress.checkpoints.map((cp) => (
                  <div key={cp.id} className="flex items-start gap-3 rounded-xl border border-border px-4 py-3">
                    <div className={`mt-0.5 size-2.5 shrink-0 rounded-full ${cp.done ? "bg-success" : "bg-muted-foreground/30"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground">{cp.label}</p>
                        <PrismStatusBadge status={cp.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{cp.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {progress.paymentMilestones.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-base font-bold text-foreground">Payment milestones</h2>
              </CardHeader>
              <CardBody>
                <PrismBillingMilestoneList milestones={progress.paymentMilestones} />
              </CardBody>
            </Card>
          )}
        </div>

        <div>
          <Card>
            <CardHeader>
              <h2 className="text-base font-bold text-foreground">Key dates</h2>
            </CardHeader>
            <CardBody>
              {progress.clientEventDayStatus && (
                <p role="status" className="mb-4 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                  {progress.clientEventDayStatus}
                </p>
              )}
              <PrismStatusTimeline items={progress.timeline} />
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ClientActionGroup
          title="Needs your action"
          description="Client decisions that can move planning forward."
          actions={needsAction}
          onAction={runClientAction}
        />
        {waiting.length > 0 ? (
          <ClientActionGroup
            title="Waiting on PMCM"
            description="Being prepared or reviewed by the event team."
            actions={waiting}
            onAction={runClientAction}
          />
        ) : null}
        {completedActions.length > 0 ? (
          <ClientActionGroup
            title="Completed"
            description="Finished client-visible workflow items."
            actions={completedActions}
            onAction={runClientAction}
          />
        ) : null}
      </div>
    </div>
  );
}
