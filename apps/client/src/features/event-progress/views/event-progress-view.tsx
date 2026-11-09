"use client";

import { WalletCards, FileText } from "lucide-react";
import { PrismStatusTimeline } from "@prism/ui/blocks";
import { PrismBillingMilestoneList } from "@prism/ui/blocks";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@prism/ui/components/item";
import { PRISM_LIFECYCLE_STAGES, PRISM_LIFECYCLE_STAGE_LABELS } from "@prism/types";
import { Card, CardHeader, CardBody } from "@/features/client-dashboard/shared/tab-ui";
import { ClientActionGroup } from "@/features/client-dashboard/shared/client-action-group";
import { ClientEventStepper, type ClientStepperStep } from "@/features/client-dashboard/shared/client-event-stepper";
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
  const lifecycleSteps: ClientStepperStep[] = PRISM_LIFECYCLE_STAGES.map((stage, index) => ({
    key: stage,
    label: PRISM_LIFECYCLE_STAGE_LABELS[stage],
    state: index < progress.lifecycleIndex ? "done" : index === progress.lifecycleIndex ? "current" : "upcoming",
  }));

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
          <ClientEventStepper steps={lifecycleSteps} label="Event lifecycle" />
        </CardBody>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="flex-row items-center gap-3 px-5 py-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-success/10 text-success">
            <FileText size={18} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {doneCheckpoints} of {progress.checkpoints.length}
            </p>
            <p className="text-xs text-muted-foreground">Checkpoints done</p>
          </div>
        </Card>
        <Card className="flex-row items-center gap-3 px-5 py-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <WalletCards size={18} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{progress.paymentMilestones.length}</p>
            <p className="text-xs text-muted-foreground">Payment milestones</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-base font-bold text-foreground">Planning checkpoints</h2>
            </CardHeader>
            <CardBody>
              <ItemGroup>
                {progress.checkpoints.map((cp) => (
                  <Item key={cp.id} variant="outline" size="sm">
                    <span aria-hidden className={`mt-1 size-2.5 shrink-0 self-start rounded-full ${cp.done ? "bg-success" : "bg-muted-foreground/30"}`} />
                    <ItemContent>
                      <ItemTitle>{cp.label}</ItemTitle>
                      <ItemDescription>{cp.detail}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <StatusBadge status={cp.status} />
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
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
