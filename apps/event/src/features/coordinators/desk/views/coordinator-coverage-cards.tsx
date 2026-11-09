import { useState, type FormEvent } from "react";
import { UsersRound } from "lucide-react";

import {
  createCoordinatorCoverageRequirementSchema,
  canonicalCoordinatorRole,
  parseContract,
  type CoordinatorRole,
  type CreateCoordinatorCoverageRequirementInput,
  type PrismCoordinatorAssignment,
  type PrismCoordinatorCoverage,
  type PrismCoordinatorPoolAvailability,
  type PrismCoordinatorRoleRequirement,
} from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { EmptyState } from "@prism/ui/components/empty-state";
import { Card, CardBody, CardHeader } from "./coordinator-desk-primitives";

export type CoverageRequirement = PrismCoordinatorRoleRequirement | PrismCoordinatorCoverage;

const INPUT_CLASS = "h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground";
const LABEL_CLASS = "grid gap-1 text-xs font-semibold text-muted-foreground";

function requirementSkills(requirement: CoverageRequirement | null): string[] {
  return requirement && "requiredSkills" in requirement ? requirement.requiredSkills : [];
}

/** How many coordinators in the whole pool are free on the event date, so PMCM knows the room before assigning. */
export function PoolAvailabilityNote({ pool }: { pool: PrismCoordinatorPoolAvailability | null }) {
  if (!pool) return null;
  const elsewhere = pool.alreadyAssigned > 0 ? ` · ${pool.alreadyAssigned} assigned to events that day` : "";
  const blocked = pool.markedUnavailable > 0 ? ` · ${pool.markedUnavailable} marked unavailable` : "";
  return (
    <p role="status" className="text-xs text-muted-foreground">
      {pool.available} of {pool.activeCoordinators} active coordinators are free on {pool.eventDate}{elsewhere}{blocked}.
    </p>
  );
}

/** Coordinators who withdrew inside the 48-hour window: the replacement is urgent, so it is not left in history. */
export function EmergencyWithdrawalsNotice({ assignments }: { assignments: PrismCoordinatorAssignment[] }) {
  const emergencies = assignments.filter((assignment) => assignment.emergencyChange);
  if (emergencies.length === 0) return null;
  return (
    <div role="alert" className="rounded-xl border border-danger/25 bg-danger/8 px-4 py-3">
      <p className="text-sm font-bold text-danger">Emergency change: a coordinator withdrew within 48 hours of the event</p>
      <ul className="mt-1.5 space-y-1 text-xs text-foreground">
        {emergencies.map((assignment) => (
          <li key={assignment.id}>
            {assignment.coordinatorName} withdrew from {assignment.role}
            {assignment.withdrawalReason ? `: ${assignment.withdrawalReason}` : ""}. Assign a replacement below.
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StaffingSummary({ roleRequirements, assignmentCounts, eventEnded = false, onEdit }: {
  roleRequirements: CoverageRequirement[];
  assignmentCounts: Map<string, number>;
  eventEnded?: boolean;
  onEdit: (requirement: CoverageRequirement) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <UsersRound className="size-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Staffing summary</h2>
        </div>
      </CardHeader>
      <CardBody>
        {roleRequirements.length === 0 ? (
          <EmptyState icon={UsersRound} title="No role requirements" description="Add role requirements to start tracking staffing coverage." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {roleRequirements.map((requirement) => (
              <RequirementTile key={requirement.role} requirement={requirement} assignedFallback={assignmentCounts.get(requirement.role) ?? 0} eventEnded={eventEnded} onEdit={onEdit} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * What a tile says about its target. Before the event it is a to-do only while the target is unmet; a met target
 * that is still unconfirmed or missing a skill says what is left. After the event it reads as a record.
 */
export function coverageTileStatus({ assigned, required, acknowledged, complete, eventEnded }: {
  assigned: number;
  required: number;
  acknowledged: number;
  complete: boolean;
  eventEnded: boolean;
}): string {
  if (eventEnded) return complete ? "Staffed" : "Not staffed";
  if (complete) return "Covered for this event.";
  if (assigned < required) return "Still needs staffing.";
  return acknowledged < required ? "Target met; waiting on acknowledgements." : "Target met; a required skill is missing.";
}

function RequirementTile({ requirement, assignedFallback, eventEnded, onEdit }: {
  requirement: CoverageRequirement;
  assignedFallback: number;
  eventEnded: boolean;
  onEdit: (requirement: CoverageRequirement) => void;
}) {
  const assigned = "assigned" in requirement ? requirement.assigned : assignedFallback;
  const acknowledged = "acknowledged" in requirement ? requirement.acknowledged : 0;
  const complete = "satisfied" in requirement ? requirement.satisfied : assigned >= requirement.required;
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-foreground">{requirement.role}</p>
        <span className={"rounded-full px-2 py-0.5 text-xs font-bold " + (complete ? "bg-success/10 text-success" : "bg-attention/10 text-attention")}>
          {assigned} of {requirement.required} assigned{"acknowledged" in requirement ? ` · ${acknowledged} acknowledged` : ""}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {coverageTileStatus({ assigned, required: requirement.required, acknowledged, complete, eventEnded })}
      </p>
      <Button type="button" size="sm" variant="ghost" className="-ml-2 mt-2" onClick={() => onEdit(requirement)}>Edit target</Button>
    </div>
  );
}

/** Seeds its fields from the target being edited; the desk remounts it (by key) when that target changes. */
export function CoverageTargetCard({ busy, roleOptions, editing, onSave, onClearEdit }: {
  busy: boolean;
  roleOptions: readonly CoordinatorRole[];
  editing: CoverageRequirement | null;
  onSave: (input: CreateCoordinatorCoverageRequirementInput) => Promise<boolean>;
  onClearEdit: () => void;
}) {
  const [role, setRole] = useState(canonicalCoordinatorRole(editing?.role) ?? "");
  const [required, setRequired] = useState(String(editing?.required ?? 1));
  const [skills, setSkills] = useState(requirementSkills(editing).join(", "));
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    try {
      const input = parseContract(createCoordinatorCoverageRequirementSchema, {
        role,
        ...(editing && !canonicalCoordinatorRole(editing.role) ? { mapFromRole: editing.role } : {}),
        required: required.trim() === "" ? Number.NaN : Number(required),
        requiredSkills: skills.split(",").map((skill) => skill.trim()).filter(Boolean),
      }, "Coordinator coverage target");
      const saved = await onSave(input);
      setMessage(saved
        ? input.mapFromRole
          ? `Coverage target mapped from ${input.mapFromRole} to ${input.role}.`
          : "Coverage target saved for " + input.role + "."
        : "Coverage target was not saved. Check the PMCM status message.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save this coverage target.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-foreground">{editing ? "Edit coverage target" : "Coverage targets"}</h2>
          {editing ? <Button type="button" size="sm" variant="ghost" onClick={onClearEdit}>New target</Button> : null}
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        <form className="space-y-3" onSubmit={(event) => void submit(event)}>
          <label className={LABEL_CLASS}>
            Role
            <select aria-label="Role" required value={role} onChange={(event) => setRole(event.target.value)} className={INPUT_CLASS}>
              <option value="">Choose a coordinator role</option>
              {roleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          {editing && !canonicalCoordinatorRole(editing.role) && (
            <p role="status" className="text-xs text-muted-foreground">
              “{editing.role}” is a historical role. Choose a catalog role to map this coverage target before saving.
            </p>
          )}
          <label className={LABEL_CLASS}>
            Required coordinators
            <input type="number" min="0" step="1" required value={required} onChange={(event) => setRequired(event.target.value)} className={INPUT_CLASS} />
          </label>
          <label className={LABEL_CLASS}>
            Required skills, comma separated
            <input value={skills} onChange={(event) => setSkills(event.target.value)} className={INPUT_CLASS} placeholder="first aid, registration" />
          </label>
          <Button type="submit" size="sm" disabled={busy || !role.trim()}>Save target</Button>
        </form>
        {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
      </CardBody>
    </Card>
  );
}
