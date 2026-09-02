import type {
  CreateEventDayTaskInput,
  CreateUrgentIssueInput,
  EscalateLiveOpsInput,
  PrismCoordinator,
  PrismEvent,
  PrismEventDayStatusFeed,
  PrismLiveOps,
  ReplaceCoordinatorAssignmentInput,
  UpdateCoordinatorAttendanceInput,
  UpdateEventDayTaskInput,
  UpdateUrgentIssueInput,
  VerifySupplierStatusInput,
} from "@prism/types";
import { useLiveOperationsWorkspaceViewModel } from "../view-models/use-live-operations-workspace-view-model";
import { LiveOpsDesk, LiveOpsOverview } from "./live-ops-sections";

export function LiveOperationsWorkspace({
  event,
  liveOps,
  statusFeed,
  coordinators,
  busy,
  onReload,
  onCreateTask,
  onUpdateTask,
  onEscalateTask,
  onCreateIssue,
  onUpdateIssue,
  onEscalateIssue,
  onUpdateCoordinatorAttendance,
  onReplaceCoordinator,
  onVerifySupplierStatus,
}: {
  event: PrismEvent;
  liveOps: PrismLiveOps | null;
  statusFeed: PrismEventDayStatusFeed | null;
  coordinators: PrismCoordinator[];
  busy: boolean;
  onReload: () => Promise<void>;
  onCreateTask: (input: CreateEventDayTaskInput) => Promise<void>;
  onUpdateTask: (taskId: string, input: UpdateEventDayTaskInput) => Promise<void>;
  onEscalateTask: (taskId: string, input: EscalateLiveOpsInput) => Promise<void>;
  onCreateIssue: (input: CreateUrgentIssueInput) => Promise<void>;
  onUpdateIssue: (issueId: string, input: UpdateUrgentIssueInput) => Promise<void>;
  onEscalateIssue: (issueId: string, input: EscalateLiveOpsInput) => Promise<void>;
  onUpdateCoordinatorAttendance: (assignmentId: string, input: UpdateCoordinatorAttendanceInput) => Promise<void>;
  onReplaceCoordinator: (assignmentId: string, input: ReplaceCoordinatorAssignmentInput) => Promise<void>;
  onVerifySupplierStatus: (requestId: string, input: VerifySupplierStatusInput) => Promise<void>;
}) {
  const vm = useLiveOperationsWorkspaceViewModel({ liveOps, busy, onCreateTask, onCreateIssue });

  return (
    <div className="space-y-5">
      <LiveOpsOverview
        event={event}
        liveOps={liveOps}
        statusFeed={statusFeed}
        metrics={vm.metrics}
        busy={busy}
        onReload={onReload}
      />
      {liveOps ? (
        <LiveOpsDesk
          liveOps={liveOps}
          coordinators={coordinators}
          busy={busy}
          vm={vm}
          onUpdateTask={onUpdateTask}
          onEscalateTask={onEscalateTask}
          onUpdateIssue={onUpdateIssue}
          onEscalateIssue={onEscalateIssue}
          onUpdateCoordinatorAttendance={onUpdateCoordinatorAttendance}
          onReplaceCoordinator={onReplaceCoordinator}
          onVerifySupplierStatus={onVerifySupplierStatus}
        />
      ) : (
        <section className="rounded-lg border border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground">
          Event-day live operations have not been loaded yet.
        </section>
      )}
    </div>
  );
}
