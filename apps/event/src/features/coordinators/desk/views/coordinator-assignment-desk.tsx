import { useMemo, useState } from "react";
import { UserCheck } from "lucide-react";

import type {
  CoordinatorRole,
  CreateCoordinatorAvailabilityInput,
  CreateCoordinatorCoverageRequirementInput,
  PrismAcknowledgementReminderResult,
  PrismCoordinator,
  PrismCoordinatorAssignment,
  PrismCoordinatorAvailability,
  PrismEvent,
  PrismEventOperatorDesignation,
} from "@prism/types";
import { COORDINATOR_ROLES, canonicalCoordinatorRole } from "@prism/types";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { dateKey } from "@/features/pmcm-kit";
import { isCoordinatorAssignmentActive, isOperatorEligibleAssignment, suggestAvailableSameRoleCoordinators } from "../model/coordinators-desk-rules";
import { PendingAcknowledgmentsPanel } from "./coordinator-acknowledgment-panel";
import { CoordinatorAvailabilityCard } from "./coordinator-availability-card";
import { CoverageTargetCard, StaffingSummary, type CoverageRequirement } from "./coordinator-coverage-cards";
import { Card, CardBody, CardHeader } from "./coordinator-desk-primitives";
import { OperatorDesignationCard } from "./coordinator-operator-card";

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
  onSaveCoverage,
  onSendReminders,
  onDesignateOperator,
  onLoadOperator,
  onLoadAvailability,
  onCreateAvailability,
  onDeleteAvailability,
}: {
  event: PrismEvent;
  coordinators: PrismCoordinator[];
  assignments: PrismCoordinatorAssignment[];
  roleRequirements: CoverageRequirement[];
  busy: boolean;
  onAssign: (coordinator: PrismCoordinator, role: CoordinatorRole, overrideConflict?: boolean) => Promise<void>;
  onSaveCoverage: (input: CreateCoordinatorCoverageRequirementInput) => Promise<boolean>;
  onSendReminders: () => Promise<PrismAcknowledgementReminderResult | null>;
  onDesignateOperator: (coordinatorId: string) => Promise<boolean>;
  onLoadOperator: () => Promise<PrismEventOperatorDesignation["operator"]>;
  onLoadAvailability: (coordinatorId: string) => Promise<PrismCoordinatorAvailability[]>;
  onCreateAvailability: (coordinatorId: string, input: CreateCoordinatorAvailabilityInput) => Promise<boolean>;
  onDeleteAvailability: (coordinatorId: string, availabilityId: string) => Promise<boolean>;
}) {
  const [roleFilter, setRoleFilter] = useState<CoordinatorRole | "all">("all");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [pendingConflict, setPendingConflict] = useState<{
    coordinator: PrismCoordinator;
    role: CoordinatorRole;
    conflict: PrismCoordinatorAssignment;
  } | null>(null);
  const [editingTarget, setEditingTarget] = useState<CoverageRequirement | null>(null);

  const eventDate = dateKey(event.eventDate);
  // assignments spans every event so double-booking can be spotted; everything else here is about this event only.
  const eventAssignments = assignments.filter((a) => a.eventId === event.id);
  const pendingAcknowledgments = eventAssignments.filter((a) => a.status === "pending_acknowledgement");
  const operatorCandidates = eventAssignments.filter(isOperatorEligibleAssignment);

  const roleOptions = COORDINATOR_ROLES;

  const assignmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    eventAssignments.filter(isCoordinatorAssignmentActive).forEach((a) => {
      counts.set(a.role, (counts.get(a.role) ?? 0) + 1);
    });
    return counts;
  }, [eventAssignments]);

  function conflictFor(coordinator: PrismCoordinator) {
    return assignments.find(
      (a) =>
        a.coordinatorId === coordinator.id &&
        a.eventId !== event.id &&
        isCoordinatorAssignmentActive(a) &&
        dateKey(a.eventDate) === eventDate,
    );
  }

  const filteredCoordinators = coordinators.filter((c) => {
    if (!c.active) return false;
    if (roleFilter !== "all" && !coordinatorRoleTags(c).some((tag) => canonicalCoordinatorRole(tag) === roleFilter)) return false;
    if (onlyAvailable && conflictFor(c)) return false;
    return true;
  });

  const groupedRoles = roleFilter === "all" ? roleOptions : [roleFilter];

  async function assign(coordinator: PrismCoordinator, role: CoordinatorRole) {
    const conflict = conflictFor(coordinator);
    if (conflict) {
      setPendingConflict({ coordinator, role, conflict });
      return;
    }
    await onAssign(coordinator, role);
  }

  return (
    <div className="space-y-5">
      <PendingAcknowledgmentsPanel assignments={pendingAcknowledgments} busy={busy} onSendReminders={onSendReminders} />

      <StaffingSummary roleRequirements={roleRequirements} assignmentCounts={assignmentCounts} onEdit={setEditingTarget} />

      <div className="grid gap-5 xl:grid-cols-3">
        <CoverageTargetCard
          key={editingTarget?.role ?? "new-target"}
          busy={busy}
          roleOptions={roleOptions}
          editing={editingTarget}
          onSave={onSaveCoverage}
          onClearEdit={() => setEditingTarget(null)}
        />
        <OperatorDesignationCard
          eventId={event.id}
          candidates={operatorCandidates}
          busy={busy}
          onLoadOperator={onLoadOperator}
          onDesignate={onDesignateOperator}
        />
        <CoordinatorAvailabilityCard
          eventId={event.id}
          eventDate={eventDate}
          coordinators={coordinators}
          assignments={eventAssignments}
          busy={busy}
          onLoad={onLoadAvailability}
          onCreate={onCreateAvailability}
          onDelete={onDeleteAvailability}
        />
      </div>

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
                  onChange={(e) => setRoleFilter(e.target.value === "all" ? "all" : canonicalCoordinatorRole(e.target.value) ?? "all")}
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
                  const roleCoords = filteredCoordinators.filter((c) => coordinatorRoleTags(c).some((tag) => canonicalCoordinatorRole(tag) === role));
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
                            (a) => a.coordinatorId === coord.id && canonicalCoordinatorRole(a.role) === role,
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
              Double-booking blocked
            </Badge>
            <h3 className="mt-4 text-base font-bold text-foreground">Choose another coordinator</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {pendingConflict.coordinator.name} is already assigned to{" "}
              {pendingConflict.conflict.conflictEventName ?? "another event"} on this date. Assign a free
              same-role coordinator instead.
            </p>
            <div className="mt-4 space-y-2">
              {suggestAvailableSameRoleCoordinators({
                coordinators,
                assignments,
                eventId: event.id,
                eventDate,
                role: pendingConflict.role,
                excludeCoordinatorId: pendingConflict.coordinator.id,
              }).map((suggestion) => {
                const coordinator = coordinators.find((item) => item.id === suggestion.id);
                if (!coordinator) return null;
                return (
                  <Button
                    key={suggestion.id}
                    disabled={busy}
                    className="w-full justify-start rounded-xl font-bold"
                    onClick={async () => {
                      setPendingConflict(null);
                      await onAssign(coordinator, pendingConflict.role);
                    }}
                  >
                    Assign {suggestion.name}
                  </Button>
                );
              })}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" className="rounded-xl font-bold" onClick={() => setPendingConflict(null)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                className="rounded-xl font-bold"
                onClick={async () => {
                  const next = pendingConflict;
                  setPendingConflict(null);
                  await onAssign(next.coordinator, next.role, true);
                }}
              >
                Override and assign anyway
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
