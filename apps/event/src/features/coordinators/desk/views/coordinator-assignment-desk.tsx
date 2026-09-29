import { useMemo, useState } from "react";
import { ChevronDown, UserCheck, UsersRound } from "lucide-react";

import { createCoordinatorAvailabilitySchema, createCoordinatorCoverageRequirementSchema, parseContract, type CreateCoordinatorAvailabilityInput, type PrismCoordinator, type PrismCoordinatorAssignment, type PrismCoordinatorAvailability, type PrismCoordinatorCoverage, type PrismCoordinatorRoleRequirement, type PrismEvent } from "@prism/types";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { dateKey } from "@/features/pmcm-kit";
import { isCoordinatorAssignmentActive, suggestAvailableSameRoleCoordinators } from "../model/coordinators-desk-rules";

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

function hasUnavailableAssignmentConflict(
  eventId: string,
  eventDate: string,
  coordinatorId: string,
  assignments: PrismCoordinatorAssignment[],
  availability: PrismCoordinatorAvailability[],
) {
  const eventDateAtMidnight = new Date(`${eventDate}T00:00:00.000Z`).getTime();
  const activelyAssigned = assignments.some((assignment) =>
    assignment.eventId === eventId &&
    assignment.coordinatorId === coordinatorId &&
    isCoordinatorAssignmentActive(assignment),
  );
  return activelyAssigned && availability.some((item) =>
    item.coordinatorId === coordinatorId &&
    item.kind === "unavailable" &&
    Date.parse(item.startsAt) <= eventDateAtMidnight &&
    Date.parse(item.endsAt) > eventDateAtMidnight,
  );
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
  onLoadAvailability,
  onCreateAvailability,
  onDeleteAvailability,
}: {
  event: PrismEvent;
  coordinators: PrismCoordinator[];
  assignments: PrismCoordinatorAssignment[];
  roleRequirements: Array<PrismCoordinatorRoleRequirement | PrismCoordinatorCoverage>;
  busy: boolean;
  onAssign: (coordinator: PrismCoordinator, role: string, overrideConflict?: boolean) => Promise<void>;
  onSaveCoverage: (input: { role: string; required: number; requiredSkills: string[] }) => Promise<boolean>;
  onSendReminders: () => Promise<boolean>;
  onDesignateOperator: (coordinatorId: string) => Promise<void>;
  onLoadAvailability: (coordinatorId: string) => Promise<PrismCoordinatorAvailability[]>;
  onCreateAvailability: (coordinatorId: string, input: CreateCoordinatorAvailabilityInput) => Promise<void>;
  onDeleteAvailability: (coordinatorId: string, availabilityId: string) => Promise<void>;
}) {
  const [roleFilter, setRoleFilter] = useState("all");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [pendingConflict, setPendingConflict] = useState<{
    coordinator: PrismCoordinator;
    role: string;
    conflict: PrismCoordinatorAssignment;
  } | null>(null);
  const [ackPanelOpen, setAckPanelOpen] = useState(true);
  const [coverageRole, setCoverageRole] = useState("");
  const [coverageRequired, setCoverageRequired] = useState("1");
  const [coverageSkills, setCoverageSkills] = useState("");
  const [coverageMessage, setCoverageMessage] = useState<string | null>(null);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [operatorId, setOperatorId] = useState("");
  const [availabilityCoordinatorId, setAvailabilityCoordinatorId] = useState("");
  const [availability, setAvailability] = useState<PrismCoordinatorAvailability[]>([]);
  const [availabilityStart, setAvailabilityStart] = useState("");
  const [availabilityEnd, setAvailabilityEnd] = useState("");
  const [availabilityNote, setAvailabilityNote] = useState("");
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  const pendingAcknowledgments = assignments.filter((a) => a.status === "pending_acknowledgement");

  async function sendReminders() {
    setReminderMessage(null);
    const sent = await onSendReminders();
    setReminderMessage(sent ? "Reminder request sent. The server applies the seven day window." : "Reminder request failed. Check the PMCM status message.");
  }

  async function saveCoverage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCoverageMessage(null);
    try {
      const input = parseContract(createCoordinatorCoverageRequirementSchema, {
        role: coverageRole,
        required: Number(coverageRequired),
        requiredSkills: coverageSkills.split(",").map((skill) => skill.trim()).filter(Boolean),
      }, "Coordinator coverage target");
      const saved = await onSaveCoverage(input);
      setCoverageMessage(saved ? `Coverage target saved for ${input.role}.` : "Coverage target was not saved. Check the PMCM status message.");
    } catch (error) {
      setCoverageMessage(error instanceof Error ? error.message : "Unable to save this coverage target.");
    }
  }

  async function loadAvailability(coordinatorId: string) {
    setAvailabilityCoordinatorId(coordinatorId);
    setAvailabilityError(null);
    if (!coordinatorId) { setAvailability([]); return; }
    setAvailabilityBusy(true);
    try { setAvailability(await onLoadAvailability(coordinatorId)); }
    catch (error) { setAvailabilityError(error instanceof Error ? error.message : "Unable to load unavailable dates."); }
    finally { setAvailabilityBusy(false); }
  }

  async function saveAvailability(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!availabilityCoordinatorId) return;
    setAvailabilityError(null);
    try {
      const input = parseContract(createCoordinatorAvailabilitySchema, {
        startsAt: new Date(availabilityStart).toISOString(),
        endsAt: new Date(availabilityEnd).toISOString(),
        kind: "unavailable",
        note: availabilityNote,
      }, "Coordinator unavailable dates");
      await onCreateAvailability(availabilityCoordinatorId, input);
      setAvailabilityNote("");
      await loadAvailability(availabilityCoordinatorId);
    } catch (error) { setAvailabilityError(error instanceof Error ? error.message : "Unable to save unavailable dates."); }
  }

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
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">Send a reminder to pending coordinators whose event is within seven days.</p>
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void sendReminders()}>Send reminders</Button>
              </div>
              {reminderMessage ? <p role="status" className="text-sm text-(--prism-success)">{reminderMessage}</p> : null}
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
                const assigned = "assigned" in req ? req.assigned : assignmentCounts.get(req.role) ?? 0;
                const acknowledged = "acknowledged" in req ? req.acknowledged : 0;
                const complete = "satisfied" in req ? req.satisfied : assigned >= req.required;
                return (
                  <div key={req.role} className="rounded-xl border border-border bg-muted/30 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-foreground">{req.role}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${complete ? "bg-(--prism-success)/10 text-(--prism-success)" : "bg-(--prism-amber)/10 text-(--prism-amber)"}`}>
                        {assigned}/{req.required}{"acknowledged" in req ? ` · ${acknowledged} ack` : ""}
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

      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader><h2 className="text-sm font-bold text-foreground">Coverage targets</h2></CardHeader>
          <CardBody className="space-y-3">
            <form className="space-y-3" onSubmit={(event) => void saveCoverage(event)}>
              <label className="grid gap-1 text-xs font-semibold text-muted-foreground">Role<input required value={coverageRole} onChange={(event) => setCoverageRole(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground" placeholder="e.g. Floor Director" /></label>
              <label className="grid gap-1 text-xs font-semibold text-muted-foreground">Required coordinators<input type="number" min="0" step="1" required value={coverageRequired} onChange={(event) => setCoverageRequired(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label>
              <label className="grid gap-1 text-xs font-semibold text-muted-foreground">Required skills, comma separated<input value={coverageSkills} onChange={(event) => setCoverageSkills(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground" placeholder="first aid, registration" /></label>
              <Button type="submit" size="sm" disabled={busy || !coverageRole.trim()}>Save target</Button>
            </form>
            {coverageMessage ? <p role="status" className="text-xs text-muted-foreground">{coverageMessage}</p> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="text-sm font-bold text-foreground">Event Day System Operator</h2></CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-muted-foreground">Choose the coordinator who will control delegated attendance and operator actions. Designating someone replaces the current operator.</p>
            <select aria-label="Event Day System Operator" value={operatorId} onChange={(event) => setOperatorId(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
              <option value="">Select a coordinator</option>
              {coordinators.filter((coordinator) => coordinator.active).map((coordinator) => <option key={coordinator.id} value={coordinator.id}>{coordinator.name}</option>)}
            </select>
            <Button type="button" size="sm" disabled={busy || !operatorId} onClick={() => void onDesignateOperator(operatorId)}>Designate operator</Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="text-sm font-bold text-foreground">Coordinator unavailability</h2></CardHeader>
          <CardBody className="space-y-3">
            <select aria-label="Coordinator availability" value={availabilityCoordinatorId} onChange={(event) => void loadAvailability(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
              <option value="">Select coordinator</option>
              {coordinators.filter((coordinator) => coordinator.active).map((coordinator) => <option key={coordinator.id} value={coordinator.id}>{coordinator.name}</option>)}
            </select>
            {availabilityBusy ? <p className="text-xs text-muted-foreground">Loading dates…</p> : null}
            {availabilityCoordinatorId && hasUnavailableAssignmentConflict(event.id, eventDate, availabilityCoordinatorId, eventAssignments, availability) ? (
              <p role="alert" className="rounded-lg border border-(--prism-amber)/25 bg-(--prism-amber)/8 px-3 py-2 text-xs font-semibold text-(--prism-amber)">
                An unavailable date overlaps this event assignment. Review coordinator coverage for {eventDate}.
              </p>
            ) : null}
            <div className="max-h-28 space-y-2 overflow-y-auto">
              {availability.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2 py-1.5 text-xs"><span>{new Date(item.startsAt).toLocaleDateString()} – {new Date(item.endsAt).toLocaleDateString()}{item.note ? ` · ${item.note}` : ""}</span><button type="button" className="text-destructive" disabled={busy} onClick={async () => { await onDeleteAvailability(item.coordinatorId, item.id); await loadAvailability(item.coordinatorId); }}>Remove</button></div>)}
              {availabilityCoordinatorId && !availabilityBusy && availability.length === 0 ? <p className="text-xs text-muted-foreground">No unavailable dates recorded.</p> : null}
            </div>
            <form className="space-y-2" onSubmit={(event) => void saveAvailability(event)}>
              <input aria-label="Unavailable from" type="datetime-local" required value={availabilityStart} onChange={(event) => setAvailabilityStart(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
              <input aria-label="Unavailable until" type="datetime-local" required value={availabilityEnd} onChange={(event) => setAvailabilityEnd(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
              <input aria-label="Availability note" value={availabilityNote} onChange={(event) => setAvailabilityNote(event.target.value)} placeholder="Optional note" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
              <Button type="submit" size="sm" disabled={busy || availabilityBusy || !availabilityCoordinatorId}>Add unavailable dates</Button>
            </form>
            {availabilityError ? <p role="alert" className="text-xs text-destructive">{availabilityError}</p> : null}
          </CardBody>
        </Card>
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
