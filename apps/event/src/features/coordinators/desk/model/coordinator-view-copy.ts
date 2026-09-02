export function optionalNavBadge(count?: number) {
  return count || undefined;
}

export function coordinatorTaskActionCopy(loading: boolean, error: string | null, count: number) {
  if (loading) return { description: "Loading assigned role tasks.", status: "loading" };
  if (error) return { description: "Role task data is unavailable.", status: "unavailable" };
  return {
    description: `${count} assigned task(s) for this role.`,
    status: count > 0 ? "open" : "clear",
  };
}

export function coordinatorIssueActionCopy(loading: boolean, error: string | null, count: number) {
  if (loading) return { description: "Loading visible urgent issues.", status: "loading" };
  if (error) return { description: "Urgent issue data is unavailable.", status: "unavailable" };
  return {
    description: `${count} visible issue(s). Escalations route to PMCM only.`,
    status: count > 0 ? "open" : "clear",
  };
}

export function coordinatorAcknowledgeCopy(status?: string) {
  if (status === "acknowledged") {
    return {
      label: "Role acknowledged",
      description: "PMCM has your definite yes.",
      active: true,
    };
  }
  return {
    label: "Acknowledge role",
    description: "Confirm this assignment before event day.",
    active: false,
  };
}

export function coordinatorShellDescription(event: { clientName: string; eventDate: string } | undefined, roleName: string) {
  if (!event) return "No assignment matched to this coordinator account.";
  return `${event.clientName} — ${event.eventDate}. Role: ${roleName}`;
}

export function coordinatorGreetingCopy(event: { eventName: string; clientName: string; eventDate: string } | undefined) {
  if (!event) {
    return {
      title: "No assigned event",
      description:
        "No assignment is matched to this coordinator account. Contact PMCM to confirm your event assignment.",
    };
  }
  return {
    title: event.eventName,
    description: `${event.clientName} — ${event.eventDate}. Your view is limited to role-safe tasks, issues, and attendance signals.`,
  };
}

export function coordinatorAttendanceDetail(assignment: { status: string } | undefined, labelStatus: (status: string) => string) {
  if (!assignment) return "No assignment state available.";
  return `Current attendance is ${labelStatus(assignment.status)}.`;
}

export function coordinatorAssignmentDetail(assignment: { status: string } | undefined, labelStatus: (status: string) => string) {
  if (!assignment) return "No active assignment.";
  return labelStatus(assignment.status);
}

export const COORDINATOR_NAV_SCROLL: Record<string, string> = {
  "coord-queue": "coordinator-role-queue",
  "coord-issues": "coordinator-live-data",
  "coord-attendance": "coordinator-attendance",
  "coord-timeline": "coordinator-timeline",
};

export const COORDINATOR_TIMELINE = [
  ["02:00", "Production ingress opens", "Technicals and staging team report to dock."],
  ["05:30", "Registration desk setup", "QR readers and fallback list checked."],
  ["08:00", "Client walkthrough", "Floor Director escorts PMCM and client."],
  ["09:00", "Doors open", "Guest arrival and welcome desk live."],
] as const;
