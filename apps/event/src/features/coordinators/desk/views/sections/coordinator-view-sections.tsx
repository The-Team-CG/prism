"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { LoadingState } from "@prism/ui/components/loading-state";
import { CoordinatorEmpty } from "./coordinator-blocks";
import type { PrismCoordinatorRoleView } from "@prism/types";
import { LiveOpsControlSurface, LiveOpsScheduleDesk } from "@/features/live-ops/schedule";
import { HandoffBriefPanel } from "@/features/live-ops/handoff-brief";
import { cn } from "@/app/components/ui/utils";

export type {
  CoordinatorOperatorActionsModel,
  CoordinatorReassignmentModel,
  CoordinatorTaskActionsModel,
} from "./coordinator-operator-sections";

/** Confirm, decline or withdraw from an assignment. A confirmed one keeps only Withdraw. */
export function CoordinatorAssignmentActions({ status, busy, onAcknowledge, onDecline, onWithdraw }: {
  status?: string;
  busy: boolean;
  onAcknowledge: () => void;
  onDecline: (reason?: string) => void;
  onWithdraw: () => void;
}) {
  if (!status) return null;
  const open = status !== "acknowledged" && status !== "declined";
  return (
    <div className="flex flex-wrap gap-2">
      {open ? <Button className="min-h-11 font-semibold" onClick={() => onAcknowledge()} disabled={busy}>Confirm assignment</Button> : null}
      {open ? (
        <Button variant="outline" className="min-h-11" onClick={() => onDecline(window.prompt("Why are you declining this assignment?")?.trim())} disabled={busy}>
          Decline
        </Button>
      ) : null}
      <Button variant="ghost" className="min-h-11" onClick={onWithdraw} disabled={busy}>Withdraw</Button>
    </div>
  );
}

function RunSheetNotPublished({ onCheckAgain }: { onCheckAgain?: () => void }) {
  return (
    <CoordinatorEmpty
      icon={CalendarClock}
      title="PMCM hasn't published the run sheet for this event yet."
      action={onCheckAgain ? <Button variant="outline" size="sm" className="min-h-10" onClick={onCheckAgain}>Check again</Button> : undefined}
      className="border-0 px-0 py-0 sm:px-0"
    >
      It appears here as soon as they do.
    </CoordinatorEmpty>
  );
}

const RUN_SHEET_VIEWS = [
  { id: "run-sheet", label: "Live run sheet", short: "Live", description: "The programme as it runs, with the current segment and its timer." },
  { id: "brief", label: "Handoff brief", short: "Handoff", description: "What the last shift left for you, and what to pass on." },
  { id: "reports", label: "Schedule and reports", short: "Reports", description: "The full schedule and the shift reports you file for PMCM." },
] as const;
type RunSheetView = (typeof RUN_SHEET_VIEWS)[number]["id"];

/** The run sheet page: one switch between the live programme, the handoff brief and shift reports. */
export function CoordinatorTimelineCard({ roleView, readOnly = false, onCheckAgain }: {
  roleView: PrismCoordinatorRoleView | null;
  readOnly?: boolean;
  onCheckAgain?: () => void;
}) {
  const [view, setView] = useState<RunSheetView>("run-sheet");
  const current = RUN_SHEET_VIEWS.find((item) => item.id === view) ?? RUN_SHEET_VIEWS[0];
  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-3">
      <div className="grid gap-2">
        <div role="group" aria-label="Run sheet views" className="grid grid-cols-3 rounded-lg bg-muted p-1 sm:inline-grid sm:w-fit">
          {RUN_SHEET_VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={view === item.id}
              aria-label={item.label}
              onClick={() => setView(item.id)}
              className={cn(
                "min-h-10 rounded-md px-3 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-ring",
                view === item.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="sm:hidden">{item.short}</span><span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </div>
        <p className="hidden px-1 text-sm text-muted-foreground sm:block">{current.description}</p>
      </div>
      <div id="coordinator-timeline" className="scroll-mt-24 rounded-xl border border-border bg-card p-4 sm:p-5">
          <fieldset disabled={readOnly} hidden={view !== "run-sheet"} className="min-w-0">
            {roleView?.schedule?.authored ? (
              <LiveOpsControlSurface eventId={roleView.event.id} schedule={roleView.schedule} timer={roleView.timer} />
            ) : roleView ? (
              <RunSheetNotPublished onCheckAgain={onCheckAgain} />
            ) : (
              <LoadingState label="Loading the run sheet." />
            )}
          </fieldset>
          {roleView ? <fieldset disabled={readOnly} hidden={view !== "brief"} className="min-w-0"><HandoffBriefPanel eventId={roleView.event.id} defaultOpen /></fieldset> : null}
          {roleView ? (
            <fieldset disabled={readOnly} hidden={view !== "reports"} className="min-w-0">
              <LiveOpsScheduleDesk
                eventId={roleView.event.id}
                assignments={roleView.coordinatorAssignments}
                canManageSchedule={Boolean(roleView.isDesignatedOperator)}
                canReplyToReports={false}
                canSubmitReports
                coordinatorScope
              />
            </fieldset>
          ) : null}
      </div>
    </div>
  );
}
