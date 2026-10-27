"use client";

import { Timer, WalletCards, FileText } from "lucide-react";
import { PrismStatusTimeline } from "@prism/ui/blocks";
import { PrismBillingMilestoneList } from "@prism/ui/blocks";
import { PrismStatusBadge } from "@prism/ui/status-badge";
import { Card, CardHeader, CardBody, SectionLabel } from "@/features/client-dashboard/shared/tab-ui";
import { ClientActionGroup } from "@/features/client-dashboard/shared/client-action-group";
import { useEventProgressView } from "../view-models/use-event-progress-view";
import { PRISM_LIFECYCLE_STAGES } from "@prism/types";

export function EventProgressView() {
  const progress = useEventProgressView();
  const { clientActions, runClientAction } = progress;

  if (!progress.hasEvent) {
    return null;
  }

  const needsAction = clientActions.filter((a) => a.tone === "primary" || a.tone === "warning");
  const waiting = clientActions.filter((a) => a.tone === "neutral");
  const completedActions = clientActions.filter((a) => a.tone === "success");

  return (
    <div className="space-y-5">
      {/* Lifecycle strip */}
      <Card>
        <CardHeader>
          <SectionLabel>Event lifecycle</SectionLabel>
          <h2 className="mt-1 text-base font-bold text-foreground">
            Current stage: {progress.lifecycleStage}
          </h2>
        </CardHeader>
        <CardBody>
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {PRISM_LIFECYCLE_STAGES.map((stage, i) => {
              const done = i < progress.lifecycleIndex;
              const current = i === progress.lifecycleIndex;
              return (
                <div
                  key={stage}
                  className={`rounded-xl border px-3 py-3 text-center text-sm ${
                    done
                      ? "border-success/30 bg-success/5 text-success"
                      : current
                        ? "border-primary/30 bg-primary/5 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <p className="text-3xs font-bold uppercase tracking-widest opacity-60">
                    Step {i + 1}
                  </p>
                  <p className="mt-1 font-bold capitalize">
                    {stage.replaceAll("_", " ")}
                  </p>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Stats row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Timer size={18} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{progress.score}%</p>
              <p className="text-xs text-muted-foreground">Progress</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <WalletCards size={18} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {progress.paymentMilestones.length}
              </p>
              <p className="text-xs text-muted-foreground">Payment milestones</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-success/10 text-success">
              <FileText size={18} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {progress.checkpoints.filter((c) => c.done).length}/{progress.checkpoints.length}
              </p>
              <p className="text-xs text-muted-foreground">Checkpoints</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main grid: checkpoints + timeline */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left column — checkpoints */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <SectionLabel>Progress checkpoints</SectionLabel>
              <h2 className="mt-1 text-base font-bold text-foreground">
                Key milestones that keep planning on track
              </h2>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                {progress.checkpoints.map((cp) => (
                  <div
                    key={cp.id}
                    className="flex items-start gap-3 rounded-xl border border-border px-4 py-3"
                  >
                    <div
                      className={`mt-0.5 size-2.5 shrink-0 rounded-full ${
                        cp.done
                          ? "bg-success"
                          : "bg-muted-foreground/30"
                      }`}
                    />
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

          {/* Payment milestones */}
          {progress.paymentMilestones.length > 0 && (
            <Card>
              <CardHeader>
                <SectionLabel>Payment milestones</SectionLabel>
                <h2 className="mt-1 text-base font-bold text-foreground">
                  Billing items visible to you
                </h2>
              </CardHeader>
              <CardBody>
                <PrismBillingMilestoneList milestones={progress.paymentMilestones} />
              </CardBody>
            </Card>
          )}
        </div>

        {/* Right column — timeline */}
        <div>
          <Card>
            <CardHeader>
              <SectionLabel>Event timeline</SectionLabel>
              <h2 className="mt-1 text-base font-bold text-foreground">
                How your event progresses through PMCM
              </h2>
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

      {/* Action groups */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ClientActionGroup
          title="Needs your action"
          description="Client decisions that can move planning forward."
          actions={needsAction}
          onAction={runClientAction}
        />
        <ClientActionGroup
          title="Waiting on PMCM"
          description="Being prepared or reviewed by the event team."
          actions={waiting}
          onAction={runClientAction}
        />
        <ClientActionGroup
          title="Completed"
          description="Finished client-visible workflow items."
          actions={completedActions}
          onAction={runClientAction}
        />
      </div>
    </div>
  );
}
