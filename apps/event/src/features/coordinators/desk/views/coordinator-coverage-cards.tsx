import { useState, type FormEvent } from "react";
import { UsersRound } from "lucide-react";

import {
  createCoordinatorCoverageRequirementSchema,
  canonicalCoordinatorRole,
  parseContract,
  type CoordinatorRole,
  type CreateCoordinatorCoverageRequirementInput,
  type PrismCoordinatorCoverage,
  type PrismCoordinatorRoleRequirement,
} from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Card, CardBody, CardHeader } from "./coordinator-desk-primitives";

export type CoverageRequirement = PrismCoordinatorRoleRequirement | PrismCoordinatorCoverage;

const INPUT_CLASS = "h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground";
const LABEL_CLASS = "grid gap-1 text-xs font-semibold text-muted-foreground";

function requirementSkills(requirement: CoverageRequirement | null): string[] {
  return requirement && "requiredSkills" in requirement ? requirement.requiredSkills : [];
}

export function StaffingSummary({ roleRequirements, assignmentCounts, onEdit }: {
  roleRequirements: CoverageRequirement[];
  assignmentCounts: Map<string, number>;
  onEdit: (requirement: CoverageRequirement) => void;
}) {
  return (
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
            {roleRequirements.map((requirement) => (
              <RequirementTile key={requirement.role} requirement={requirement} assignedFallback={assignmentCounts.get(requirement.role) ?? 0} onEdit={onEdit} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function RequirementTile({ requirement, assignedFallback, onEdit }: {
  requirement: CoverageRequirement;
  assignedFallback: number;
  onEdit: (requirement: CoverageRequirement) => void;
}) {
  const assigned = "assigned" in requirement ? requirement.assigned : assignedFallback;
  const acknowledged = "acknowledged" in requirement ? requirement.acknowledged : 0;
  const complete = "satisfied" in requirement ? requirement.satisfied : assigned >= requirement.required;
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-foreground">{requirement.role}</p>
        <span className={"rounded-full px-2 py-0.5 text-xs font-bold " + (complete ? "bg-(--prism-success)/10 text-(--prism-success)" : "bg-(--prism-amber)/10 text-(--prism-amber)")}>
          {assigned}/{requirement.required}{"acknowledged" in requirement ? " · " + acknowledged + " ack" : ""}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{complete ? "Covered for this event." : "Still needs staffing."}</p>
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
