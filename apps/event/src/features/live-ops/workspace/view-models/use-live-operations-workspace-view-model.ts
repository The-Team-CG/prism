import { useMemo, useState } from "react";

import type {
  BlockEventDayTaskInput,
  CoordinatorRole,
  CreateEventDayTaskInput,
  CreateUrgentIssueInput,
  PrismLiveOps,
} from "@prism/types";
import { blockEventDayTaskSchema, canonicalCoordinatorRole, parseContract } from "@prism/types";
import {
  asIsoDateTime,
  computeLiveOpsMetrics,
} from "../model/live-ops-workspace-rules";

type LiveOperationsWorkspaceViewModelProps = {
  liveOps: PrismLiveOps | null;
  busy: boolean;
  onCreateTask: (input: CreateEventDayTaskInput) => Promise<void>;
  onCreateIssue: (input: CreateUrgentIssueInput) => Promise<void>;
  onBlockTask: (taskId: string, input: BlockEventDayTaskInput) => Promise<void>;
  onUnblockTask: (taskId: string) => Promise<void>;
};

export function useLiveOperationsWorkspaceViewModel({
  liveOps,
  busy,
  onCreateTask,
  onCreateIssue,
  onBlockTask,
  onUnblockTask,
}: LiveOperationsWorkspaceViewModelProps) {
  const [taskTitle, setTaskTitle] = useState("");
  const [taskRole, setTaskRoleState] = useState<CoordinatorRole>("General Coordinator");
  const [taskPriority, setTaskPriority] = useState("normal");
  const [taskSlaDueAt, setTaskSlaDueAt] = useState("");
  const [issueTitle, setIssueTitle] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [issueSeverity, setIssueSeverity] = useState<"low" | "medium" | "high" | "critical">("high");
  const [issueAffectedArea, setIssueAffectedArea] = useState("");
  const [issueOwnerRole, setIssueOwnerRole] = useState("Event Day System Operator");
  const [issueSlaDueAt, setIssueSlaDueAt] = useState("");
  const [issueFormOpen, setIssueFormOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [blockingTaskId, setBlockingTaskId] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const metrics = useMemo(() => computeLiveOpsMetrics(liveOps), [liveOps]);

  function startBlockTask(taskId: string) {
    setBlockingTaskId(taskId);
    setBlockReason("");
  }

  function cancelBlockTask() {
    setBlockingTaskId(null);
    setBlockReason("");
  }

  async function confirmBlockTask() {
    if (!blockingTaskId) return;
    const input = parseContract(blockEventDayTaskSchema, { reason: blockReason }, "Event-day task blocker");
    await onBlockTask(blockingTaskId, input);
    cancelBlockTask();
  }

  async function unblockTask(taskId: string) {
    await onUnblockTask(taskId);
  }

  async function createTask() {
    await onCreateTask({
      title: taskTitle,
      assignedRole: taskRole,
      priority: taskPriority,
      slaDueAt: asIsoDateTime(taskSlaDueAt),
    });
    setTaskTitle("");
    setTaskSlaDueAt("");
    setTaskFormOpen(false);
  }

  async function createIssue() {
    await onCreateIssue({
      title: issueTitle,
      description: issueDescription.trim() || undefined,
      severity: issueSeverity,
      affectedArea: issueAffectedArea.trim() || undefined,
      ownerRole: issueOwnerRole,
      slaDueAt: asIsoDateTime(issueSlaDueAt),
    });
    setIssueTitle("");
    setIssueDescription("");
    setIssueAffectedArea("");
    setIssueSlaDueAt("");
    setIssueFormOpen(false);
  }

  return {
    metrics,
    taskTitle,
    setTaskTitle,
    taskRole,
    setTaskRole: (value: string) => {
      const role = canonicalCoordinatorRole(value);
      if (role) setTaskRoleState(role);
    },
    taskPriority,
    setTaskPriority,
    taskSlaDueAt,
    setTaskSlaDueAt,
    issueTitle,
    setIssueTitle,
    issueDescription,
    setIssueDescription,
    issueSeverity,
    setIssueSeverity,
    issueAffectedArea,
    setIssueAffectedArea,
    issueOwnerRole,
    setIssueOwnerRole,
    issueSlaDueAt,
    setIssueSlaDueAt,
    issueFormOpen,
    toggleIssueForm: () => setIssueFormOpen((open) => !open),
    taskFormOpen,
    toggleTaskForm: () => setTaskFormOpen((open) => !open),
    blockingTaskId,
    blockReason,
    setBlockReason,
    startBlockTask,
    cancelBlockTask,
    confirmBlockTask,
    unblockTask,
    createTask,
    createIssue,
    status: busy ? ("loading" as const) : ("idle" as const),
    error: null,
  };
}
