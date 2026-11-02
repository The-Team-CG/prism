import { useMemo, useState } from "react";
import { ChevronDown, UserCheck } from "lucide-react";

import type {
  CoordinatorRole,
  CreateCoordinatorAvailabilityInput,
  CreateCoordinatorCoverageRequirementInput,
  PrismAcknowledgementReminderResult,
  PrismCoordinator,
  PrismCoordinatorAssignment,
  PrismCoordinatorAvailability,
  PrismCoordinatorReliabilityHistoryEntry,
  PrismCoordinatorSuggestion,
  PrismEvent,
  PrismEventOperatorDesignation,
} from "@prism/types";
import { COORDINATOR_ROLES, canonicalCoordinatorRole } from "@prism/types";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { dateKey } from "@/features/pmcm-kit";
import {
  activeAssignmentForRole,
  coordinatorSkillFilterOptions,
  isCoordinatorAssignmentActive,
  isOperatorEligibleAssignment,
  otherActiveRoleAssignment,
} from "../model/coordinators-desk-rules";
import { PendingAcknowledgmentsPanel } from "./coordinator-acknowledgment-panel";
import { CoordinatorAvailabilityCard } from "./coordinator-availability-card";
import { CoordinatorReliabilityHistory } from "./coordinator-reliability-history";
import { CoverageTargetCard, StaffingSummary, type CoverageRequirement } from "./coordinator-coverage-cards";
import { Card, CardBody, CardHeader } from "./coordinator-desk-primitives";
import { OperatorDesignationCard } from "./coordinator-operator-card";

type SuggestionLoadStatus = "idle" | "loading" | "loaded" | "empty" | "error";
type CoordinatorIdentity = Pick<PrismCoordinator, "id" | "name">;

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
  onLoadSuggestions,
  onSaveCoverage,
  onSendReminders,
  onDesignateOperator,
  onRevokeOperator,
  onLoadOperator,
  onLoadAvailability,
  onLoadReliabilityHistory,
  onCreateAvailability,
  onDeleteAvailability,
}: {
  event: PrismEvent;
  coordinators: PrismCoordinator[];
  assignments: PrismCoordinatorAssignment[];
  roleRequirements: CoverageRequirement[];
  busy: boolean;
  onAssign: (coordinator: CoordinatorIdentity, role: CoordinatorRole, overrideConflict?: boolean) => Promise<void>;
  onLoadSuggestions: (role: CoordinatorRole, skills: string[]) => Promise<PrismCoordinatorSuggestion[]>;
  onSaveCoverage: (input: CreateCoordinatorCoverageRequirementInput) => Promise<boolean>;
  onSendReminders: () => Promise<PrismAcknowledgementReminderResult | null>;
  onDesignateOperator: (coordinatorId: string) => Promise<boolean>;
  onRevokeOperator?: () => Promise<boolean>;
  onLoadOperator: () => Promise<PrismEventOperatorDesignation["operator"]>;
  onLoadAvailability: (coordinatorId: string) => Promise<PrismCoordinatorAvailability[]>;
  onLoadReliabilityHistory: (coordinatorId: string) => Promise<PrismCoordinatorReliabilityHistoryEntry[]>;
  onCreateAvailability: (coordinatorId: string, input: CreateCoordinatorAvailabilityInput) => Promise<boolean>;
  onDeleteAvailability: (coordinatorId: string, availabilityId: string) => Promise<boolean>;
}) {
  const [roleFilter, setRoleFilter] = useState<CoordinatorRole | "all">("all");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [pendingConflict, setPendingConflict] = useState<{
    coordinator: CoordinatorIdentity;
    role: CoordinatorRole;
    conflict: PrismCoordinatorAssignment;
  } | null>(null);
  const [editingTarget, setEditingTarget] = useState<CoverageRequirement | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillSuggestions, setSkillSuggestions] = useState<PrismCoordinatorSuggestion[]>([]);
  const [skillSuggestionStatus, setSkillSuggestionStatus] = useState<SuggestionLoadStatus>("idle");
  const [conflictSuggestions, setConflictSuggestions] = useState<PrismCoordinatorSuggestion[]>([]);
  const [conflictSuggestionStatus, setConflictSuggestionStatus] = useState<SuggestionLoadStatus>("idle");

  const eventDate = dateKey(event.eventDate);
  // assignments spans every event so double-booking can be spotted; everything else here is about this event only.
  const eventAssignments = assignments.filter((a) => a.eventId === event.id);
  const pendingAcknowledgments = eventAssignments.filter((a) => a.status === "pending_acknowledgement");
  const operatorCandidates = eventAssignments.filter(isOperatorEligibleAssignment);

  const roleOptions = COORDINATOR_ROLES;
  const skillOptions = useMemo(
    () => coordinatorSkillFilterOptions(coordinators, roleFilter),
    [coordinators, roleFilter],
  );

  const assignmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    eventAssignments.filter(isCoordinatorAssignmentActive).forEach((a) => {
      counts.set(a.role, (counts.get(a.role) ?? 0) + 1);
    });
    return counts;
  }, [eventAssignments]);

  function conflictFor(coordinatorId: string) {
    return assignments.find(
      (a) =>
        a.coordinatorId === coordinatorId &&
        a.eventId !== event.id &&
        isCoordinatorAssignmentActive(a) &&
        dateKey(a.eventDate) === eventDate,
    );
  }

  const filteredCoordinators = coordinators.filter((c) => {
    if (!c.active) return false;
    if (roleFilter !== "all" && !coordinatorRoleTags(c).some((tag) => canonicalCoordinatorRole(tag) === roleFilter)) return false;
    if (onlyAvailable && conflictFor(c.id)) return false;
    return true;
  });

  const groupedRoles = roleFilter === "all" ? roleOptions : [roleFilter];

  async function assign(coordinator: CoordinatorIdentity, role: CoordinatorRole) {
    const conflict = conflictFor(coordinator.id);
    if (conflict) {
      setPendingConflict({ coordinator, role, conflict });
      setConflictSuggestions([]);
      setConflictSuggestionStatus("loading");
      try {
        const suggestions = await onLoadSuggestions(role, []);
        setConflictSuggestions(suggestions);
        setConflictSuggestionStatus(suggestions.length > 0 ? "loaded" : "empty");
      } catch {
        setConflictSuggestionStatus("error");
      }
      return;
    }
    await onAssign(coordinator, role);
  }

  async function findSkillSuggestions() {
    if (roleFilter === "all") return;
    setSkillSuggestionStatus("loading");
    setSkillSuggestions([]);
    try {
      const suggestions = await onLoadSuggestions(roleFilter, selectedSkills);
      setSkillSuggestions(suggestions);
      setSkillSuggestionStatus(suggestions.length > 0 ? "loaded" : "empty");
    } catch {
      setSkillSuggestionStatus("error");
    }
  }

  function updateSelectedSkill(skill: string, checked: boolean) {
    setSelectedSkills((current) => checked
      ? [...current, skill]
      : current.filter((item) => item !== skill));
    setSkillSuggestions([]);
    setSkillSuggestionStatus("idle");
  }

  return (
    <div className="space-y-5">
      <PendingAcknowledgmentsPanel assignments={pendingAcknowledgments} busy={busy} onSendReminders={onSendReminders} />

      <StaffingSummary roleRequirements={roleRequirements} assignmentCounts={assignmentCounts} onEdit={setEditingTarget} />

      {/* Coordinator assignment */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserCheck className="size-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Coordinator assignment</h2>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
            {/* Filters */}
            <div className="space-y-4 rounded-2xl border border-border bg-muted/30 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Role</p>
                <select
                  aria-label="Coordinator role filter"
                  value={roleFilter}
                  disabled={skillSuggestionStatus === "loading"}
                  onChange={(e) => {
                    const nextRole = e.target.value === "all" ? "all" : canonicalCoordinatorRole(e.target.value) ?? "all";
                    setRoleFilter(nextRole);
                    setSelectedSkills([]);
                    setSkillSuggestions([]);
                    setSkillSuggestionStatus("idle");
                  }}
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
              <CoordinatorSkillFilters roleFilter={roleFilter} status={skillSuggestionStatus} options={skillOptions} selected={selectedSkills} onChange={updateSelectedSkill} />
              <Button
                type="button"
                size="sm"
                disabled={roleFilter === "all" || skillSuggestionStatus === "loading"}
                onClick={() => void findSkillSuggestions()}
                className="w-full"
              >
                Find skill matches
              </Button>
            </div>

            {/* Coordinator list */}
            <div className="space-y-5">
              <CoordinatorSkillResults status={skillSuggestionStatus} suggestions={skillSuggestions} busy={busy} onAssign={assign} />
              {filteredCoordinators.length === 0 ? (
                <EmptyState icon={UserCheck} title="No coordinators match" description="Adjust role or availability filters to see more coordinators." />
              ) : (
                groupedRoles.map((role) => {
                  const roleCoords = filteredCoordinators.filter((c) => coordinatorRoleTags(c).some((tag) => canonicalCoordinatorRole(tag) === role));
                  if (roleCoords.length === 0) return null;
                  return (
                    <div key={role}>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{role}</h3>
                        <span className="text-xs text-muted-foreground">{roleCoords.length} match{roleCoords.length === 1 ? "" : "es"}</span>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {roleCoords.map((coord) => {
                          const conflict = conflictFor(coord.id);
                          const assignedHere = Boolean(activeAssignmentForRole(eventAssignments, coord.id, role));
                          return (
                            <div key={`${role}-${coord.id}`} role="group" aria-label={`${role}: ${coord.name}`} className="rounded-2xl border border-border bg-muted/30 p-4">
                              <div className="flex items-start gap-3">
                                <Avatar className="size-10 border border-border">
                                  <AvatarFallback className="bg-card text-xs font-bold text-foreground">
                                    {coord.name.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-bold text-foreground">{coord.name}</p>
                                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${conflict ? "text-attention" : "text-success"}`}>
                                      <span aria-hidden className="size-1.5 rounded-full bg-current" />
                                      {conflict ? "Has conflict" : "Available"}
                                    </span>
                                  </div>
                                  <p className="mt-0.5 text-xs text-muted-foreground">{coord.email}</p>
                                  <p className="mt-2 text-xs text-foreground">{coordinatorRoleTags(coord).join(" · ")}</p>
                                  {coord.skillsTags.length > 0 && (
                                    <p className="mt-0.5 text-xs text-muted-foreground">Skills: {coord.skillsTags.join(", ")}</p>
                                  )}
                                  {conflict && (
                                    <p className="mt-2 text-xs font-semibold text-attention">
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
                                    const holding = activeAssignmentForRole(eventAssignments, coord.id, role);
                                    if (!holding) {
                                      const other = otherActiveRoleAssignment(eventAssignments, coord.id, role);
                                      return other ? <p className="mt-2 text-xs text-muted-foreground">Assigned as {canonicalCoordinatorRole(other.role) ?? other.role}</p> : null;
                                    }
                                    if (holding.status !== "pending_acknowledgement" && holding.status !== "acknowledged") return null;
                                    const isPending = holding.status === "pending_acknowledgement";
                                    return (
                                      <p className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold ${isPending ? "text-attention" : "text-success"}`}>
                                        <span aria-hidden className="size-1.5 rounded-full bg-current" />
                                        {isPending ? "Awaiting acknowledgement" : "Acknowledged"}
                                      </p>
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

      {/* Planning tools are used occasionally; assigning people is the main job of this tab. */}
      <details open={editingTarget ? true : undefined} className="group rounded-xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
          <span>
            <span className="block text-sm font-semibold text-foreground">Staffing tools</span>
            <span className="block text-xs text-muted-foreground">Coverage targets, event-day operator, unavailability and reliability history</span>
          </span>
          <ChevronDown aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-5 border-t border-border p-5">
        <CoordinatorReliabilityHistory
          coordinators={coordinators}
          assignments={assignments}
          onLoad={onLoadReliabilityHistory}
        />

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
            onRevoke={onRevokeOperator}
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
        </div>
      </details>

      {/* Conflict modal */}
      {pendingConflict && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-base font-bold text-foreground">Double booking: choose another coordinator</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {pendingConflict.coordinator.name} is already assigned to{" "}
              {pendingConflict.conflict.conflictEventName ?? "another event"} on this date. Assign a free
              same-role coordinator instead.
            </p>
            <div className="mt-4 space-y-2">
              {conflictSuggestionStatus === "loading" && <p role="status" className="text-sm text-muted-foreground">Finding available {pendingConflict.role.toLowerCase()} coordinators…</p>}
              {conflictSuggestionStatus === "error" && <p role="status" className="text-sm text-destructive">Could not load coordinator suggestions. You can cancel or keep the explicit override.</p>}
              {conflictSuggestionStatus === "empty" && <p role="status" className="text-sm text-muted-foreground">No available same-role coordinators were found.</p>}
              {conflictSuggestions.map((suggestion) => {
                const suggestionRole = canonicalCoordinatorRole(suggestion.role);
                if (!suggestionRole) return null;
                return (
                  <div key={suggestion.id} className="rounded-xl border border-border bg-muted/30 p-3">
                    <p className="text-sm font-semibold text-foreground">{suggestion.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {suggestion.matchedSkillCount} of {suggestion.requiredSkillCount} required skills matched
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Matched: {suggestion.matchedSkills.join(", ") || "None"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Missing: {suggestion.missingSkills.join(", ") || "None"}</p>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      className="mt-2 w-full justify-start rounded-xl font-bold"
                      onClick={async () => {
                        setPendingConflict(null);
                        await onAssign({ id: suggestion.id, name: suggestion.name }, suggestionRole);
                      }}
                    >
                      Assign {suggestion.name}
                    </Button>
                  </div>
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

function CoordinatorSkillFilters({ roleFilter, status, options, selected, onChange }: {
  roleFilter: CoordinatorRole | "all";
  status: SuggestionLoadStatus;
  options: string[];
  selected: string[];
  onChange: (skill: string, checked: boolean) => void;
}) {
  return (
              <fieldset disabled={roleFilter === "all" || status === "loading"} className="space-y-2">
                <legend className="text-sm font-semibold text-foreground">Required skill tags</legend>
                {roleFilter === "all" ? (
                  <p className="text-xs leading-5 text-muted-foreground">Choose a role to filter by skill.</p>
                ) : options.length === 0 ? (
                  <p className="text-xs leading-5 text-muted-foreground">No skill tags are recorded for this role.</p>
                ) : (
                  <div className="space-y-1.5">
                    {options.map((skill) => (
                      <label key={skill} className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={selected.includes(skill)}
                          onChange={(e) => onChange(skill, e.target.checked)}
                          className="size-4 rounded"
                        />
                        {skill}
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
  );
}

function CoordinatorSkillResults({ status, suggestions, busy, onAssign }: {
  status: SuggestionLoadStatus;
  suggestions: PrismCoordinatorSuggestion[];
  busy: boolean;
  onAssign: (coordinator: CoordinatorIdentity, role: CoordinatorRole) => Promise<void>;
}) {
  return <>
              {status === "loading" && <p role="status" className="text-sm text-muted-foreground">Loading skill matches…</p>}
              {status === "error" && <p role="status" className="text-sm text-destructive">Could not load skill matches. Try again.</p>}
              {status === "empty" && <p role="status" className="text-sm text-muted-foreground">No coordinators match this role and skill selection.</p>}
              {status === "loaded" && (
                <section aria-labelledby="coordinator-skill-suggestions-title" className="space-y-3 rounded-2xl border border-border bg-card p-4">
                  <h3 id="coordinator-skill-suggestions-title" className="text-sm font-bold text-foreground">Skill match suggestions</h3>
                  {suggestions.map((suggestion) => {
                    const suggestionRole = canonicalCoordinatorRole(suggestion.role);
                    if (!suggestionRole) return null;
                    return (
                      <div key={suggestion.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{suggestion.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {suggestion.matchedSkillCount} of {suggestion.requiredSkillCount} required skills matched
                          </p>
                          <p className="text-xs text-muted-foreground">Matched: {suggestion.matchedSkills.join(", ") || "None"}</p>
                          <p className="text-xs text-muted-foreground">Missing: {suggestion.missingSkills.join(", ") || "None"}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() => void onAssign({ id: suggestion.id, name: suggestion.name }, suggestionRole)}
                        >
                          Assign {suggestion.name}
                        </Button>
                      </div>
                    );
                  })}
                </section>
              )}
  </>;
}
