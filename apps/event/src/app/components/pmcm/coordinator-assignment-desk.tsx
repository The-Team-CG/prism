import { useMemo, useState } from "react";
import { UserCheck, UsersRound } from "lucide-react";

import type {
  MvpCoordinator,
  MvpCoordinatorAssignment,
  MvpCoordinatorRoleRequirement,
  MvpEvent,
} from "@/lib/mvp-api";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { cx, dateKey } from "./helpers";
import { Panel } from "./primitives";

export function CoordinatorAssignmentDesk({
  event,
  coordinators,
  assignments,
  roleRequirements,
  busy,
  onAssign,
}: {
  event: MvpEvent;
  coordinators: MvpCoordinator[];
  assignments: MvpCoordinatorAssignment[];
  roleRequirements: MvpCoordinatorRoleRequirement[];
  busy: boolean;
  onAssign: (coordinator: MvpCoordinator, role: string, overrideConflict?: boolean) => Promise<void>;
}) {
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [pendingConflict, setPendingConflict] = useState<{
    coordinator: MvpCoordinator;
    role: string;
    conflict: MvpCoordinatorAssignment;
  } | null>(null);

  const eventDate = dateKey(event.eventDate);
  const eventAssignments = assignments.filter((assignment) => assignment.eventId === event.id);
  const roleOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...roleRequirements.map((item) => item.role),
          ...coordinators.flatMap((coordinator) => coordinator.roleTags),
        ]),
      ).sort((a, b) => a.localeCompare(b)),
    [coordinators, roleRequirements],
  );
  const skillOptions = useMemo(
    () =>
      Array.from(new Set(coordinators.flatMap((coordinator) => coordinator.skillsTags))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [coordinators],
  );
  const assignmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    eventAssignments.forEach((assignment) => {
      counts.set(assignment.role, (counts.get(assignment.role) ?? 0) + 1);
    });
    return counts;
  }, [eventAssignments]);

  function conflictFor(coordinator: MvpCoordinator) {
    return assignments.find(
      (assignment) =>
        assignment.coordinatorId === coordinator.id &&
        assignment.eventId !== event.id &&
        dateKey(assignment.eventDate) === eventDate,
    );
  }

  function toggleSkill(skill: string) {
    setSelectedSkills((current) =>
      current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill],
    );
  }

  const filteredCoordinators = coordinators.filter((coordinator) => {
    const roleMatch = roleFilter === "all" || coordinator.roleTags.includes(roleFilter);
    const skillMatch = selectedSkills.every((skill) => coordinator.skillsTags.includes(skill));
    const availabilityMatch = !onlyAvailable || !conflictFor(coordinator);
    return coordinator.active && roleMatch && skillMatch && availabilityMatch;
  });
  const groupedRoles = roleFilter === "all" ? roleOptions : [roleFilter];

  async function assign(coordinator: MvpCoordinator, role: string) {
    const conflict = conflictFor(coordinator);
    if (conflict) {
      setPendingConflict({ coordinator, role, conflict });
      return;
    }
    await onAssign(coordinator, role);
  }

  return (
    <div className="space-y-5">
      <Panel title="Staffing summary" icon={UsersRound}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {roleRequirements.map((item) => {
            const assigned = assignmentCounts.get(item.role) ?? 0;
            const complete = assigned >= item.required;
            return (
              <div key={item.role} className="rounded-md border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black">{item.role}</p>
                  <span className={cx("rounded-full px-2 py-0.5 text-xs font-black ring-1", complete ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-amber-50 text-amber-800 ring-amber-100")}>
                    {assigned}/{item.required}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {complete ? "Covered for this event." : "Still needs staffing."}
                </p>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Coordinator assignment" icon={UserCheck}>
        <div className="grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)]">
          <div className="space-y-3 rounded-md border border-border bg-background p-3">
            <label className="block text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
              Role
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm font-semibold normal-case tracking-normal text-foreground"
              >
                <option value="all">All roles</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-md bg-white p-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(event) => setOnlyAvailable(event.target.checked)}
              />
              Available only
            </label>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Skills</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {skillOptions.map((skill) => (
                  <button
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    className={cx(
                      "rounded-full px-2.5 py-1 text-xs font-black ring-1",
                      selectedSkills.includes(skill)
                        ? "bg-(--prism-ink) text-sidebar-foreground ring-transparent"
                        : "bg-white text-muted-foreground ring-border",
                    )}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {groupedRoles.map((role) => {
              const roleCoordinators = filteredCoordinators.filter((coordinator) =>
                coordinator.roleTags.includes(role),
              );
              if (roleCoordinators.length === 0) return null;
              return (
                <section key={role} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">{role}</h4>
                    <span className="text-xs font-semibold text-muted-foreground">{roleCoordinators.length} available match{roleCoordinators.length === 1 ? "" : "es"}</span>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {roleCoordinators.map((coordinator) => {
                      const conflict = conflictFor(coordinator);
                      const assignedHere = eventAssignments.some(
                        (assignment) => assignment.coordinatorId === coordinator.id && assignment.role === role,
                      );
                      return (
                        <article key={`${role}-${coordinator.id}`} className="rounded-lg border border-border bg-muted p-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="size-11 border border-primary/10">
                              <AvatarFallback className="bg-white text-xs font-black text-foreground">
                                {coordinator.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-black">{coordinator.name}</p>
                                <Badge variant="outline" className={cx("rounded-full px-2 py-0.5 text-[11px] font-black", conflict ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
                                  {conflict ? "Has conflict" : "Available"}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{coordinator.email}</p>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {coordinator.roleTags.map((tag) => (
                                  <span key={tag} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-foreground">{tag}</span>
                                ))}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {coordinator.skillsTags.map((tag) => (
                                  <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{tag}</span>
                                ))}
                              </div>
                              {conflict && (
                                <p className="mt-3 text-xs font-semibold text-amber-800">
                                  Already assigned to {conflict.conflictEventName ?? "another event"} on {eventDate}.
                                </p>
                              )}
                              <Button
                                disabled={busy || assignedHere}
                                onClick={() => assign(coordinator, role)}
                                className="mt-4 h-9 rounded-md text-xs font-black"
                              >
                                <UserCheck className="size-4" /> {assignedHere ? "Assigned" : conflict ? "Review conflict" : "Quick assign"}
                              </Button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
            {filteredCoordinators.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground">
                No coordinators match the active role, skill, and availability filters.
              </div>
            )}
          </div>
        </div>
      </Panel>

      {pendingConflict && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-2xl">
            <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-800">Double-booking warning</Badge>
            <h3 className="mt-4 text-xl font-black text-foreground">Confirm coordinator assignment</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {pendingConflict.coordinator.name} is already assigned to {pendingConflict.conflict.conflictEventName ?? "another event"} on this date. Are you sure you want to assign them?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" className="rounded-md" onClick={() => setPendingConflict(null)}>Cancel</Button>
              <Button
                disabled={busy}
                className="rounded-md font-black"
                onClick={async () => {
                  const next = pendingConflict;
                  setPendingConflict(null);
                  await onAssign(next.coordinator, next.role, true);
                }}
              >
                Yes, assign anyway
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
