import type {
  CreateFileRequirementInput,
  PrismFileRequirementItem,
  PrismFileRequirementsMatrix,
  UpdateFileRequirementInput,
} from "@prism/types";
import { roleLabel, statusLabel } from "@/features/pmcm-kit/model/display-labels";

export const FILE_HUB_HELP_COPY =
  "Upload deliverables in Stored event files. Confirmed files are shared with the client and available to download from the event file hub.";

export const FILE_REQUIREMENT_ROLE_OPTIONS = [
  { value: "pmcm-admin", label: "PMCM administrator" },
  { value: "client", label: "Client" },
  { value: "coordinator", label: "Coordinator" },
  { value: "supplier", label: "Supplier" },
] as const;

/** Form state for PMCM edits. Strings are raw input values; the use-case validates them through @prism/types. */
export type FileRequirementDraft = {
  key: string;
  label: string;
  ownerRole: string;
  visibleToRoles: string[];
  required: boolean;
  dueDate: string;
  notes: string;
};

export function emptyFileRequirementDraft(): FileRequirementDraft {
  return { key: "", label: "", ownerRole: "client", visibleToRoles: ["pmcm-admin", "client"], required: true, dueDate: "", notes: "" };
}

export function draftFromFileRequirementItem(item: PrismFileRequirementItem): FileRequirementDraft {
  return {
    key: item.key,
    label: item.label,
    ownerRole: item.ownerRole,
    visibleToRoles: [...item.visibleToRoles],
    required: item.required,
    dueDate: item.dueDate ? item.dueDate.slice(0, 10) : "",
    notes: item.notes ?? "",
  };
}

/** A due date is the end of the chosen PMCM calendar day, so a same-day upload is not overdue. */
export function dueDateToIso(date: string): string | null {
  if (!date) return null;
  return new Date(`${date}T23:59:59`).toISOString();
}

export function formatFileRequirementDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function sameMembers(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && [...left].sort().join(",") === [...right].sort().join(",");
}

/**
 * Only changed fields are sent, with the revision the edit was based on.
 * Returns null when nothing changed so the form can skip the request.
 * Derived items keep their label because the API rejects relabelling them.
 */
function labelChange(item: PrismFileRequirementItem, draft: FileRequirementDraft): Partial<UpdateFileRequirementInput> {
  return item.origin === "custom" && draft.label.trim() !== item.label ? { label: draft.label.trim() } : {};
}

function dueAtChange(item: PrismFileRequirementItem, draft: FileRequirementDraft): Partial<UpdateFileRequirementInput> {
  return draft.dueDate !== (item.dueDate ? item.dueDate.slice(0, 10) : "") ? { dueAt: dueDateToIso(draft.dueDate) } : {};
}

export function buildFileRequirementUpdate(item: PrismFileRequirementItem, draft: FileRequirementDraft): UpdateFileRequirementInput | null {
  const changes: Partial<UpdateFileRequirementInput> = { ...labelChange(item, draft), ...dueAtChange(item, draft) };
  if (draft.ownerRole !== item.ownerRole) changes.ownerRole = draft.ownerRole as UpdateFileRequirementInput["ownerRole"];
  if (!sameMembers(draft.visibleToRoles, item.visibleToRoles)) changes.visibleToRoles = draft.visibleToRoles as UpdateFileRequirementInput["visibleToRoles"];
  if (draft.required !== item.required) changes.required = draft.required;
  if (draft.notes.trim() !== (item.notes ?? "")) changes.notes = draft.notes.trim() || null;
  if (Object.keys(changes).length === 0) return null;
  return { ...changes, expectedRevision: item.revision ?? 0 };
}

export function buildFileRequirementCreate(draft: FileRequirementDraft): CreateFileRequirementInput {
  return {
    key: draft.key.trim(),
    label: draft.label.trim(),
    ownerRole: draft.ownerRole as CreateFileRequirementInput["ownerRole"],
    visibleToRoles: draft.visibleToRoles as CreateFileRequirementInput["visibleToRoles"],
    required: draft.required,
    dueAt: dueDateToIso(draft.dueDate),
    sourceWorkflow: "custom",
    notes: draft.notes.trim() || undefined,
  };
}

const STATUS_ORDER: Record<string, number> = {
  missing: 0,
  pending: 1,
  submitted: 2,
  generated: 3,
  approved: 4,
  complete: 5,
};

export function sortFileRequirementItems(items: PrismFileRequirementItem[]) {
  return [...items].sort((left, right) => {
    const overdue = Number(right.overdue) - Number(left.overdue);
    return overdue || (STATUS_ORDER[left.status] ?? 9) - (STATUS_ORDER[right.status] ?? 9) || left.label.localeCompare(right.label);
  });
}

export function fileRequirementCounts(matrix: PrismFileRequirementsMatrix | null) {
  const items = matrix?.items ?? [];
  return {
    total: items.length,
    open: items.filter((item) => item.status === "missing" || item.status === "pending").length,
    overdue: items.filter((item) => item.overdue).length,
  };
}

const FILE_WORKFLOW_LABELS: Record<string, string> = {
  custom: "Custom requirement",
  closure: "Closure",
  floorplans: "Floorplans",
  client_onboarding: "Client onboarding",
  commercial: "Commercial",
  live_ops: "Live operations",
  supplier_network: "Supplier network",
};

/** One readable metadata line: owner, audience, and source workflow in product terms. */
export function fileRequirementMetadataLine(item: Pick<PrismFileRequirementItem, "ownerRole" | "visibleToRoles" | "sourceWorkflow">): string {
  const audience = [...new Set(item.visibleToRoles)].map(roleLabel).join(", ");
  const workflow = FILE_WORKFLOW_LABELS[item.sourceWorkflow] ?? statusLabel(item.sourceWorkflow);
  return `Owner: ${roleLabel(item.ownerRole)} · Visible to ${audience || "—"} · ${workflow}`;
}
