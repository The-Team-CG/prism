import { useMemo, useState } from "react";
import { ChevronDown, UserCheck, UsersRound } from "lucide-react";

import type { PrismCoordinator, PrismCoordinatorRoleRequirement } from "@/lib/prism-api";
import type { PrismCoordinatorAssignment, PrismEvent } from "@prism/types";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { dateKey } from "@/features/pmcm-kit";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-card shadow-sm ${className}`}>{children}</div>;
}
function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-border px-6 py-4">{children}</div>;
}
function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
}
function SectionAccent({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">{children}</p>;
}

function coordinatorRoleTags(coordinator: PrismCoordinator) {
  const legacy = coordinator as PrismCoordinator & { roles?: string[] };
  if (Array.isArray(coordinator.roleTags)) return coordinator.roleTags;
  if (Array.isArray(legacy.roles)) return legacy.roles;
  return [];
}

export function CoordinatorAssignmentDesk({
  event,
  coordinators,
  assignments,
  roleRequirements,
  busy,
  onAssign,
}: {
  event: PrismEvent;
  coordinators: PrismCoordinator[];
  assignments: PrismCoordinatorAssignment[];
  roleRequirements: PrismCoordinatorRoleRequirement[];
  busy: boolean;
  onAssign: (coordinator: PrismCoordinator, role: string, overrideConflict?: boolean) => Promise<void>;
}) {
  const [roleFilter, setRoleFilter] = useState("all");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [pendingConflict, setPendingConflict] = useState<{
    coordinator: PrismCoordinator;
    role: string;
    conflict: PrismCoordinatorAssignment;
  } | null>(null);
  const [ackPanelOpen, setAckPanelOpen] = useState(true);

  const pendingAcknowledgments = assignments.filter((a) => a.status === "pending_acknowledgement");

  const eventDate = dateKey(event.eventDate);
  const eventAssignments = assignments.filter((a) => a.eventId === event.id);

  const roleOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...roleRequirements.map((r) => r.role),
          ...coordinators.flatMap(coordinatorRoleTags),
        ]),
      ).sort((a, b) => a.localeCompare(b)),
    [coordinators, roleRequirements],
  );

  const assignmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    eventAssignments.forEach((a) => {
      counts.set(a.role, (counts.get(a.role) ?? 0) + 1);
    });
    return counts;
  }, [eventAssignments]);

  function conflictFor(coordinator: PrismCoordinator) {
    return assignments.find(
      (a) =>
        a.coordinatorId === coordinator.id &&
        a.eventId !== event.id &&
        dateKey(a.eventDate) === eventDate,
    );
  }

  const filteredCoordinators = coordinators.filter((c) => {
    if (!c.active) return false;
    if (roleFilter !== "all" && !coordinatorRoleTags(c).includes(roleFilter)) return false;
    if (onlyAvailable && conflictFor(c)) return false;
    return true;
  });

  const groupedRoles = roleFilter === "all" ? roleOptions : [roleFilter];

  async function assign(coordinator: PrismCoordinator, role: string) {
    const conflict = conflictFor(coordinator);
    if (conflict) {
      setPendingConflict({ coordinator, role, conflict });
      return;
    }
    await onAssign(coordinator, role);
  }

  return (
    <div className="space-y-5">
      {/* Pending acknowledgments */}
      {pendingAcknowledgments.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserCheck className="size-4 text-(--prism-amber)" />
                <h2 className="text-sm font-bold text-foreground">Pending Acknowledgments</h2>
                <span className="rounded-full bg-(--prism-amber)/10 px-2 py-0.5 text-[10px] font-bold text-(--prism-amber)">
                  {pendingAcknowledgments.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAckPanelOpen((prev) => !prev)}
                className="grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted"
              >
                <ChevronDown className={`size-4 transition-transform ${ackPanelOpen ? "rotate-180" : ""}`} />
              </button>
            </div>
          </CardHeader>
          {ackPanelOpen && (
            <CardBody className="space-y-1">
              {pendingAcknowledgments.map((asg) => (
                <div key={asg.id} className="flex items-center justify-between gap-4 rounded-xl bg-muted/30 px-4 py-2.5">
                  <p className="text-sm font-bold text-foreground">{asg.coordinatorName}</p>
                  <span className="rounded-full border border-(--prism-amber)/25 bg-(--prism-amber)/8 px-2 py-0.5 text-[10px] font-bold text-(--prism-amber)">{asg.role}</span>
                </div>
              ))}
            </CardBody>
          )}
        </Card>
      )}

      {/* Staffing summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UsersRound className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Staffing summary</h2>
          </div>
        </CardHeader>
        <CardBody>
          {roleRequirements.length === 0 ? (
            <EmptyState icon={UsersRound} title="No role requirements" description="Add role requirements to start tracking staffing coverage." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {roleRequirements.map((req) => {
                const assigned = assignmentCounts.get(req.role) ?? 0;
                const complete = assigned >= req.required;
                return (
                  <div key={req.role} className="rounded-xl border border-border bg-muted/30 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-foreground">{req.role}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${complete ? "bg-(--prism-success)/10 text-(--prism-success)" : "bg-(--prism-amber)/10 text-(--prism-amber)"}`}>
                        {assigned}/{req.required}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {complete ? "Covered for this event." : "Still needs staffing."}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Coordinator assignment */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserCheck className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Coordinator assignment</h2>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
            {/* Filters */}
            <div className="space-y-4 rounded-2xl border border-border bg-muted/30 p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">Role</p>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="mt-2 h-9 w-full rounded-xl border border-border bg-background px-3 text-sm"
                >
                  <option value="all">All roles</option>
                  {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={(e) => setOnlyAvailable(e.target.checked)}
                  className="size-4 rounded"
                />
                Available only
              </label>
            </div>

            {/* Coordinator list */}
            <div className="space-y-5">
              {filteredCoordinators.length === 0 ? (
                <EmptyState icon={UserCheck} title="No coordinators match" description="Adjust role or availability filters to see more coordinators." />
              ) : (
                groupedRoles.map((role) => {
                  const roleCoords = filteredCoordinators.filter((c) => coordinatorRoleTags(c).includes(role));
                  if (roleCoords.length === 0) return null;
                  return (
                    <div key={role}>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">{role}</p>
                        <span className="text-xs text-muted-foreground">{roleCoords.length} match{roleCoords.length === 1 ? "" : "es"}</span>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {roleCoords.map((coord) => {
                          const conflict = conflictFor(coord);
                          const assignedHere = eventAssignments.some(
                            (a) => a.coordinatorId === coord.id && a.role === role,
                          );
                          return (
                            <div key={`${role}-${coord.id}`} className="rounded-2xl border border-border bg-muted/30 p-4">
                              <div className="flex items-start gap-3">
                                <Avatar className="size-10 border border-border">
                                  <AvatarFallback className="bg-card text-xs font-bold text-foreground">
                                    {coord.name.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-bold text-foreground">{coord.name}</p>
                                    <Badge
                                      variant="outline"
                                      className={`rounded-full text-[10px] font-bold ${conflict ? "border-(--prism-amber)/25 bg-(--prism-amber)/8 text-(--prism-amber)" : "border-(--prism-success)/25 bg-(--prism-success)/8 text-(--prism-success)"}`}
                                    >
                                      {conflict ? "Has conflict" : "Available"}
                                    </Badge>
                                  </div>
                                  <p className="mt-0.5 text-xs text-muted-foreground">{coord.email}</p>
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {coordinatorRoleTags(coord).map((tag) => (
                                      <span key={tag} className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-bold text-foreground">{tag}</span>
                                    ))}
                                  </div>
                                  {coord.skillsTags.length > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                      {coord.skillsTags.map((tag) => (
                                        <span key={tag} className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{tag}</span>
                                      ))}
                                    </div>
                                  )}
                                  {conflict && (
                                    <p className="mt-2 text-xs font-semibold text-(--prism-amber)">
                                      Assigned to {conflict.conflictEventName ?? "another event"} on {eventDate}.
                                    </p>
                                  )}
                                  <Button
                                    size="sm"
                                    disabled={busy || assignedHere}
                                    onClick={() => assign(coord, role)}
                                    className="mt-3 rounded-xl font-bold"
                                    variant={assignedHere ? "outline" : "default"}
                                  >
                                    <UserCheck className="size-3.5" />
                                    {assignedHere ? "Assigned" : conflict ? "Review conflict" : "Quick assign"}
                                  </Button>
                                  {(() => {
                                    const asg = eventAssignments.find((a) => a.coordinatorId === coord.id);
                                    if (!asg || (asg.status !== "pending_acknowledgement" && asg.status !== "acknowledged")) return null;
                                    const isPending = asg.status === "pending_acknowledgement";
                                    return (
                                      <Badge
                                        variant="outline"
                                        className={`mt-2 rounded-full text-[10px] font-bold ${isPending ? "border-(--prism-amber)/25 bg-(--prism-amber)/8 text-(--prism-amber)" : "border-(--prism-success)/25 bg-(--prism-success)/8 text-(--prism-success)"}`}
                                      >
                                        {isPending ? "Pending Acknowledgment" : "Acknowledged"}
                                      </Badge>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Conflict modal */}
      {pendingConflict && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <Badge variant="outline" className="rounded-full border-(--prism-amber)/25 bg-(--prism-amber)/8 text-(--prism-amber)">
              Double-booking warning
            </Badge>
            <h3 className="mt-4 text-base font-bold text-foreground">Confirm coordinator assignment</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {pendingConflict.coordinator.name} is already assigned to{" "}
              {pendingConflict.conflict.conflictEventName ?? "another event"} on this date. Are you sure you want to assign them?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" className="rounded-xl font-bold" onClick={() => setPendingConflict(null)}>
                Cancel
              </Button>
              <Button
                disabled={busy}
                className="rounded-xl font-bold"
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
