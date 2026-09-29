export type SaveState = "idle" | "saving" | "saved" | "error";

export function statusLabel(value?: string) {
  return (value ?? "draft").replaceAll("_", " ");
}

export function saveStatusText(saveState: SaveState): string {
  if (saveState === "saving") return "Saving";
  if (saveState === "error") return "Save failed";
  return "Saved";
}

export function saveStatusToneClass(saveState: SaveState): string {
  if (saveState === "error") return "bg-rose-50 text-rose-700";
  return "bg-emerald-50 text-emerald-700";
}

export function panelOpenClass(open: boolean): string {
  if (open) return "text-foreground";
  return "text-neutral-500";
}

export function panelToggleTitle(open: boolean, hideLabel: string, showLabel: string): string {
  if (open) return hideLabel;
  return showLabel;
}

export function canUndoHistory(readOnly: boolean, pastLength: number): boolean {
  if (readOnly) return false;
  return pastLength > 0;
}

export function canRedoHistory(readOnly: boolean, futureLength: number): boolean {
  if (readOnly) return false;
  return futureLength > 0;
}

export function canSubmitReview(
  readOnly: boolean,
  draftStatus: string | undefined,
  hasSubmit: boolean,
): boolean {
  if (readOnly) return false;
  if (draftStatus === "approved") return false;
  return hasSubmit;
}

export function saveActionDisabled(hasSave: boolean, saveState: SaveState): boolean {
  if (!hasSave) return true;
  return saveState === "saving";
}
