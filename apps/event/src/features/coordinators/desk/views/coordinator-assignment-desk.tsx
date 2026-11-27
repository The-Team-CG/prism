import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { ChevronDown } from "lucide-react";

import type {
  CoordinatorRole,
  CreateCoordinatorAvailabilityInput,
  CreateCoordinatorCoverageRequirementInput,
  PrismAcknowledgementReminderResult,
  PrismCoordinator,
  PrismCoordinatorAssignment,
  PrismCoordinatorAvailability,
  PrismCoordinatorPoolAvailability,
  PrismCoordinatorReliabilityHistoryEntry,
  PrismCoordinatorSuggestion,
  PrismEvent,
  PrismEventOperatorDesignation,
} from "@prism/types";
import { COORDINATOR_ROLES, canonicalCoordinatorRole, hasEventDatePassed, prismCalendarDateKey, coordinatorRoleLabel } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { dateKey } from "@/features/pmcm-kit";
import {
  coordinatorSkillFilterOptions,
  coordinatorHasAllSkills,
  isCoordinatorAssignmentActive,
  isOperatorEligibleAssignment,
} from "../model/coordinators-desk-rules";
import { PendingAcknowledgmentsPanel } from "./coordinator-acknowledgment-panel";
import { CoordinatorAvailabilityCard } from "./coordinator-availability-card";
import { CoordinatorReliabilityHistory } from "./coordinator-reliability-history";
import { CoverageTargetCard, EmergencyWithdrawalsNotice, PoolAvailabilityNote, StaffingSummary, type CoverageRequirement } from "./coordinator-coverage-cards";
import { FieldDescription } from "@prism/ui/components/field";
import { OperatorDesignationCard } from "./coordinator-operator-card";
import { roleCoverageRows, roleCoverageSummary } from "./coordinator-role-coverage";
import { CoordinatorFieldingList, RoleNeedChips } from "./coordinator-fielding";
import { formatPortalDate } from "@prism/ui/format-date";
import { LoadingState } from "@prism/ui/components/loading-state";

type SuggestionLoadStatus = "idle" | "loading" | "loaded" | "empty" | "error";
type CoordinatorIdentity = Pick<PrismCoordinator, "id" | "name">;

function coordinatorRoleTags(coordinator: PrismCoordinator) {
  const legacy = coordinator as PrismCoordinator & { roles?: string[] };
  if (Array.isArray(coordinator.roleTags)) return coordinator.roleTags;
  if (Array.isArray(legacy.roles)) return legacy.roles;
  return [];
}

/** Active, tagged for the chosen role, free that day when only available ones are shown, and holding every chosen skill. */
function fitsFinder(c: PrismCoordinator, { roleFilter, selectedSkills, booked }: { roleFilter: CoordinatorRole | "all"; selectedSkills: string[]; booked: boolean }) {
  if (!c.active || booked) return false;
  if (roleFilter !== "all" && !coordinatorRoleTags(c).some((tag) => canonicalCoordinatorRole(tag) === roleFilter)) return false;
  return coordinatorHasAllSkills(c, selectedSkills);
}

function matchesSearch(c: PrismCoordinator, query: string) {
  const needle = query.trim().toLowerCase();
  return !needle || [c.name, c.email, ...coordinatorRoleTags(c), ...c.skillsTags].join(" ").toLowerCase().includes(needle);
}

export function CoordinatorAssignmentDesk({
  event,
  coordinators,
  assignments,
  roleRequirements,
  busy,
  onAssign,
  onChangeRole,
  onLoadSuggestions,
  onLoadPoolAvailability,
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
  /** Moves a coordinator's existing assignment on this event to another role, keeping its acknowledgement. */
  onChangeRole?: (assignmentId: string, role: CoordinatorRole) => Promise<void>;
  onLoadSuggestions: (role: CoordinatorRole, skills: string[]) => Promise<PrismCoordinatorSuggestion[]>;
  onLoadPoolAvailability?: () => Promise<PrismCoordinatorPoolAvailability | null>;
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
  const [query, setQuery] = useState("");
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

  const [pool, setPool] = useState<PrismCoordinatorPoolAvailability | null>(null);
  // Assignments and withdrawals change who is free, so the count reloads whenever the roster of assignments does.
  const assignmentSignature = eventAssignments.map((a) => a.id + ":" + a.status).join("|");
  useEffect(() => {
    if (!onLoadPoolAvailability) return;
    let current = true;
    onLoadPoolAvailability().then((next) => { if (current) setPool(next); }).catch(() => { if (current) setPool(null); });
    return () => { current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the loader is a fresh closure each render; the event and assignment state drive reloads
  }, [event.id, assignmentSignature]);

  const roleOptions = COORDINATOR_ROLES;
  const skillOptions = useMemo(
    () => coordinatorSkillFilterOptions(coordinators, roleFilter),
    [coordinators, roleFilter],
  );

  const coverageRows = useMemo(() => roleCoverageRows(COORDINATOR_ROLES, eventAssignments, roleRequirements), [eventAssignments, roleRequirements]);

  function findForRole(role: CoordinatorRole | "all") {
    setRoleFilter(role);
    setSelectedSkills([]);
    setSkillSuggestions([]);
    setSkillSuggestionStatus("idle");
    window.setTimeout(() => document.getElementById("coordinator-finder")?.scrollIntoView({ block: "start", behavior: "smooth" }), 0);
  }

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

  const filteredCoordinators = coordinators.filter((c) => fitsFinder(c, { roleFilter, selectedSkills, booked: onlyAvailable && Boolean(conflictFor(c.id)) }));
  const visibleCoordinators = filteredCoordinators.filter((c) => matchesSearch(c, query));

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
      <EmergencyWithdrawalsNotice assignments={eventAssignments} />

      <PendingAcknowledgmentsPanel assignments={pendingAcknowledgments} busy={busy} onSendReminders={onSendReminders} />

      <PoolAvailabilityNote pool={pool} />

      {roleRequirements.length > 0 ? (
        <StaffingSummary roleRequirements={roleRequirements} assignmentCounts={assignmentCounts} eventEnded={hasEventDatePassed(event.eventDate, prismCalendarDateKey())} onEdit={setEditingTarget} />
      ) : null}

      {/* Fielding: who is on the event, in which role, and one action per person to field or move them. */}
      <section id="coordinator-finder" aria-labelledby="coordinator-fielding-title" className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card">
        <header className="grid gap-3 px-5 pb-3 pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="coordinator-fielding-title" className="text-base font-semibold text-foreground">Fielding</h2>
            {coverageRows.length ? <p className="text-sm text-muted-foreground">{roleCoverageSummary(coverageRows)}</p> : null}
          </div>
          <RoleNeedChips rows={coverageRows} active={roleFilter} onPick={findForRole} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-0 flex-1 basis-48">
              <span className="sr-only">Search coordinators</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, role or skill"
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
              />
            </label>
            <Select
              value={roleFilter}
              disabled={skillSuggestionStatus === "loading"}
              onValueChange={(value) => findForRole(value === "all" ? "all" : canonicalCoordinatorRole(value) ?? "all")}
            >
              <SelectTrigger aria-label="Coordinator role filter" className="h-9 w-48 min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roleOptions.map((r) => <SelectItem key={r} value={r}>{coordinatorRoleLabel(r)}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground">
              <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} className="size-4 rounded" />
              Available only
            </label>
            <SkillFilterMenu roleFilter={roleFilter} status={skillSuggestionStatus} options={skillOptions} selected={selectedSkills} onChange={updateSelectedSkill} onFind={() => void findSkillSuggestions()} />
          </div>
          <CoordinatorSkillResults status={skillSuggestionStatus} suggestions={skillSuggestions} busy={busy} onAssign={assign} />
        </header>
        {visibleCoordinators.length === 0 ? (
          <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">No coordinators match. Clear the search, choose All roles or untick Available only.</p>
        ) : (
          <div className="border-t border-border">
            <CoordinatorFieldingList
              coordinators={visibleCoordinators}
              eventAssignments={eventAssignments}
              conflictFor={conflictFor}
              roleFilter={roleFilter}
              coverage={coverageRows}
              eventDateLabel={formatPortalDate(event.eventDate)}
              busy={busy}
              onField={(coordinator, role) => void assign(coordinator, role)}
              onMove={onChangeRole}
            />
          </div>
        )}
      </section>

      {/* Planning tools are used occasionally; assigning people is the main job of this tab. */}
      <details open={editingTarget ? true : undefined} className="group rounded-lg border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
          <span>
            <span className="block text-sm font-semibold text-foreground">Staffing tools</span>
            <span className="block text-xs text-muted-foreground">Coverage targets, onsite operator, unavailability and reliability history</span>
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
        <Dialog open onOpenChange={(open) => { if (!open) setPendingConflict(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Double booking: choose another coordinator</DialogTitle>
              <DialogDescription>
                {pendingConflict.coordinator.name} is already assigned to{" "}
                {pendingConflict.conflict.conflictEventName ?? "another event"} on this date. Assign a free
                same-role coordinator instead.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {conflictSuggestionStatus === "loading" && <p role="status" className="text-sm text-muted-foreground">Finding available {pendingConflict.role.toLowerCase()} coordinators…</p>}
              {conflictSuggestionStatus === "error" && <p role="status" className="text-sm text-destructive">Could not load coordinator suggestions. You can cancel or keep the explicit override.</p>}
              {conflictSuggestionStatus === "empty" && <p role="status" className="text-sm text-muted-foreground">No available same-role coordinators were found.</p>}
              {conflictSuggestions.map((suggestion) => {
                const suggestionRole = canonicalCoordinatorRole(suggestion.role);
                if (!suggestionRole) return null;
                return (
                  <div key={suggestion.id} className="rounded-lg border border-border bg-muted/30 p-3">
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
                      className="mt-2 w-full justify-start rounded-lg font-semibold"
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
            <DialogFooter className="mt-5">
              <Button variant="outline" className="rounded-lg font-semibold" onClick={() => setPendingConflict(null)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                className="rounded-lg font-semibold"
                onClick={async () => {
                  const next = pendingConflict;
                  setPendingConflict(null);
                  await onAssign(next.coordinator, next.role, true);
                }}
              >
                Override and assign anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/** The finder's "Skills" menu: required skill tags for the chosen role, and a search for coordinators who hold them. */
function SkillFilterMenu({ onFind, ...filters }: ComponentProps<typeof CoordinatorSkillFilters> & { onFind: () => void }) {
  const { roleFilter, status, selected } = filters;
  return (
    <details className="relative">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1 rounded-md border border-border bg-background px-3 text-sm text-foreground">
        Skills{selected.length ? ` · ${selected.length}` : ""}<ChevronDown aria-hidden className="size-4" />
      </summary>
      <div className="absolute right-0 z-20 mt-1 grid w-72 gap-3 rounded-lg border border-border bg-popover p-3 shadow-lg">
        <CoordinatorSkillFilters {...filters} />
        <Button type="button" size="sm" disabled={roleFilter === "all" || status === "loading"} onClick={onFind}>
          Find skill matches
        </Button>
        {roleFilter === "all" ? <FieldDescription>Choose a role to search by skill.</FieldDescription> : null}
      </div>
    </details>
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
              {status === "loading" && <LoadingState label="Loading skill matches…" />}
              {status === "error" && <p role="status" className="text-sm text-destructive">Could not load skill matches. Try again.</p>}
              {status === "empty" && <p role="status" className="text-sm text-muted-foreground">No coordinators match this role and skill selection.</p>}
              {status === "loaded" && (
                <section aria-labelledby="coordinator-skill-suggestions-title" className="space-y-3 rounded-lg border border-border bg-card p-4">
                  <h3 id="coordinator-skill-suggestions-title" className="text-sm font-semibold text-foreground">Skill match suggestions</h3>
                  {suggestions.map((suggestion) => {
                    const suggestionRole = canonicalCoordinatorRole(suggestion.role);
                    if (!suggestionRole) return null;
                    return (
                      <div key={suggestion.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
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
